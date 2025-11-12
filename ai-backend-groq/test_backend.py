"""
Script de prueba para el backend unificado de EduPlay
Prueba todos los endpoints principales
"""

import requests
import base64
import json

# Configuración
BASE_URL = "http://localhost:3000"  # Cambiar a la URL de Render en producción

def test_health():
    """Prueba el endpoint de health check"""
    print("🏥 Probando /health...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.ok:
            data = response.json()
            print(f"✅ Health check OK: {data}")
            return True
        else:
            print(f"❌ Health check falló: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_tts():
    """Prueba el endpoint de text-to-speech"""
    print("\n🔊 Probando /tts...")
    try:
        response = requests.post(
            f"{BASE_URL}/tts",
            json={
                "text": "Hola, esta es una prueba del servicio de texto a voz.",
                "language": "es",
                "speed": 1.0
            }
        )
        if response.ok:
            # Guardar el audio para verificar
            with open("test_audio.mp3", "wb") as f:
                f.write(response.content)
            print(f"✅ TTS OK - Audio guardado en test_audio.mp3 ({len(response.content)} bytes)")
            return True
        else:
            print(f"❌ TTS falló: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_transcribe():
    """Prueba el endpoint de transcripción"""
    print("\n🎤 Probando /transcribe...")

    # Crear un audio simple de prueba (silencio de 1 segundo en WAV)
    # Header WAV básico
    sample_rate = 16000
    duration = 1
    num_samples = sample_rate * duration

    # Construir WAV header + datos
    import struct
    wav_data = b'RIFF'
    wav_data += struct.pack('<I', 36 + num_samples * 2)
    wav_data += b'WAVEfmt '
    wav_data += struct.pack('<IHHIIHH', 16, 1, 1, sample_rate, sample_rate * 2, 2, 16)
    wav_data += b'data'
    wav_data += struct.pack('<I', num_samples * 2)
    wav_data += b'\x00\x00' * num_samples

    # Convertir a base64
    audio_base64 = base64.b64encode(wav_data).decode('utf-8')

    try:
        response = requests.post(
            f"{BASE_URL}/transcribe",
            json={
                "audio": audio_base64,
                "format": "wav",
                "language": "es"
            },
            timeout=30
        )
        if response.ok:
            data = response.json()
            print(f"✅ Transcripción OK: {data}")
            return True
        else:
            print(f"❌ Transcripción falló: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_chat():
    """Prueba el endpoint de chat"""
    print("\n💬 Probando /chat...")
    try:
        response = requests.post(
            f"{BASE_URL}/chat",
            json={
                "messages": [
                    {"role": "user", "content": "Di 'Hola' en una palabra"}
                ],
                "model": "llama-3.3-70b-versatile",
                "temperature": 0.7,
                "max_tokens": 50
            },
            timeout=30
        )
        if response.ok:
            data = response.json()
            print(f"✅ Chat OK: {json.dumps(data, indent=2)[:200]}...")
            return True
        else:
            print(f"❌ Chat falló: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("🧪 Iniciando pruebas del backend EduPlay...")
    print(f"📡 URL: {BASE_URL}\n")

    results = []

    # Ejecutar todas las pruebas
    results.append(("Health Check", test_health()))
    results.append(("Text-to-Speech", test_tts()))
    results.append(("Transcripción", test_transcribe()))
    results.append(("Chat", test_chat()))

    # Resumen
    print("\n" + "="*50)
    print("📊 RESUMEN DE PRUEBAS")
    print("="*50)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")

    print(f"\n🎯 Resultado: {passed}/{total} pruebas pasaron")

    if passed == total:
        print("✨ ¡Todas las pruebas pasaron exitosamente!")
    else:
        print("⚠️ Algunas pruebas fallaron. Revisa los detalles arriba.")

if __name__ == "__main__":
    main()

