using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using CulturalTourismSystem.Service.Chat;

var results = new List<object>();
var comparisons = new List<object>();
foreach (var kind in new[] { "silence", "dc", "noise", "speech_like" })
{
    var frames = Enumerable.Range(0, 64).Select(index => Frame(kind, index)).ToArray();
    using var managed = new WebRtcVoiceActivityDetector();
    using var native = new WebRtcVadSharp.WebRtcVad
    {
        SampleRate = WebRtcVadSharp.SampleRate.Is16kHz,
        FrameLength = WebRtcVadSharp.FrameLength.Is20ms,
        OperatingMode = WebRtcVadSharp.OperatingMode.Aggressive
    };
    var differences = 0;
    var nativeSpeech = 0;
    var managedSpeech = 0;
    for (var index = 0; index < 2000; index++)
    {
        var frame = frames[index % frames.Length];
        var expected = native.HasSpeech(frame);
        var actual = managed.IsSpeech(frame, false);
        if (expected) nativeSpeech++;
        if (actual) managedSpeech++;
        if (expected != actual) differences++;
    }
    comparisons.Add(new { kind, differences, nativeSpeech, managedSpeech });
    using var detector = new AdaptiveWebRtcVoiceActivityDetector(new());
    for (var index = 0; index < 10_000; index++) detector.IsSpeech(frames[index % frames.Length], false);
    const int frameCount = 100_000;
    var allocated = GC.GetAllocatedBytesForCurrentThread();
    var speechBefore = detector.SpeechFrames;
    var started = Stopwatch.GetTimestamp();
    for (var index = 0; index < frameCount; index++) detector.IsSpeech(frames[index % frames.Length], false);
    var elapsed = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
    var bytes = GC.GetAllocatedBytesForCurrentThread() - allocated;
    results.Add(new
    {
        kind, frameCount, elapsedMs = elapsed, microsecondsPerFrame = elapsed * 1000 / frameCount,
        allocatedBytes = bytes, speechFrames = detector.SpeechFrames - speechBefore, noiseRms = detector.NoiseRms,
        estimatedSingleCorePercentAt45Rooms = elapsed / frameCount * 50 * 45 / 10
    });
}
Console.WriteLine(JsonSerializer.Serialize(new
{
    runtime = RuntimeInformation.FrameworkDescription,
    architecture = RuntimeInformation.ProcessArchitecture.ToString(), comparisons, results
}, new JsonSerializerOptions { WriteIndented = true }));

static byte[] Frame(string kind, int frameIndex)
{
    var bytes = new byte[640];
    var random = new Random(1000 + frameIndex);
    for (var sample = 0; sample < 320; sample++)
    {
        var time = (frameIndex * 320 + sample) / 16000d;
        var envelope = 0.5 + 0.5 * Math.Sin(time * 2 * Math.PI * 4);
        var value = kind switch
        {
            "dc" => 2000,
            "noise" => random.Next(-3000, 3001),
            "speech_like" => (int)(envelope * (2500 * Math.Sin(time * 2 * Math.PI * 140)
                + 1700 * Math.Sin(time * 2 * Math.PI * 420) + 1200 * Math.Sin(time * 2 * Math.PI * 980)
                + 700 * Math.Sin(time * 2 * Math.PI * 2100))),
            _ => 0
        };
        bytes[sample * 2] = (byte)value;
        bytes[sample * 2 + 1] = (byte)(value >> 8);
    }
    return bytes;
}
