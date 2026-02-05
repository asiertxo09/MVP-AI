
export class RewardSystem {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.coinContainer = null;
        this.ensureContainer();
    }

    ensureContainer() {
        if (!document.getElementById('coin-shower-container')) {
            this.coinContainer = document.createElement('div');
            this.coinContainer.id = 'coin-shower-container';
            this.coinContainer.className = 'coin-shower-container';
            document.body.appendChild(this.coinContainer);
        } else {
            this.coinContainer = document.getElementById('coin-shower-container');
        }
    }

    triggerStreak(count) {
        // Visual Popup
        const popup = document.createElement('div');
        popup.className = 'streak-popup';
        popup.innerHTML = `🔥 ${count} SEGUIDAS!`;
        document.body.appendChild(popup);

        setTimeout(() => popup.remove(), 2500);

        // Audio: Rising Pitch based on count
        this.playStreakSound(count);
    }

    triggerCoinShower(amount = 10) {
        this.ensureContainer();
        this.playCoinSound();

        for (let i = 0; i < amount; i++) {
            const coin = document.createElement('div');
            coin.className = 'coin';

            // Random start position
            const startX = Math.random() * window.innerWidth;
            coin.style.left = `${startX}px`;
            coin.style.top = `-50px`;

            this.coinContainer.appendChild(coin);

            // Animate
            const duration = 1000 + Math.random() * 1000;
            const keyframes = [
                { transform: `translate(0, 0) rotate(0deg)` },
                { transform: `translate(${Math.random() * 100 - 50}px, ${window.innerHeight + 50}px) rotate(${Math.random() * 360}deg)` }
            ];

            const anim = coin.animate(keyframes, {
                duration: duration,
                easing: 'cubic-bezier(0.5, 0.05, 0.1, 0.3)'
            });

            anim.onfinish = () => coin.remove();
        }
    }

    playStreakSound(streak) {
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Pentatonic Scale-ish or Harmonic series
        // Base 440. Streak 1=440, 2=554(C#), 3=659(E), 4=880(A)
        const baseFreq = 440;
        const multiplier = 1 + (streak * 0.2);

        osc.frequency.setValueAtTime(baseFreq * multiplier, this.ctx.currentTime);
        osc.type = 'triangle';

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playCoinSound() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        // High ping
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(2000, this.ctx.currentTime + 0.1);
        osc.type = 'sine';

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
}
