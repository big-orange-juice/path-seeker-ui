using System.Net;
using System.Net.Http.Headers;
using CulturalTourismSystem.Service.Chat;
using Microsoft.Extensions.Configuration;

var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["MiniMax:ApiKey"] = "test-only", ["MiniMax:BaseUrl"] = "https://fixture.test",
}).Build();
var passed = 0;
async Task Check(string name, Func<Task> action) {
    await action(); passed++; Console.WriteLine($"PASS {name}");
}
void Equal<T>(T expected, T actual) {
    if (!EqualityComparer<T>.Default.Equals(expected, actual)) throw new Exception($"Expected {expected}; got {actual}");
}
async Task Fails(string json, HttpStatusCode status, string expected) {
    using var http = new HttpClient(new Handler(_ => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(json) })));
    var client = new MiniMaxSpeechToTextClient(new Factory(http), configuration);
    try {
        await client.TranscribeAsync(new MemoryStream(new byte[44]), "utterance.wav", "audio/wav", CancellationToken.None);
        throw new Exception("Expected transcription failure");
    } catch (InvalidOperationException exception) {
        if (!exception.Message.Contains(expected)) throw;
    }
}
await Check("success and multipart contract", async () => {
    using var http = new HttpClient(new Handler(async request => {
        Equal("https://fixture.test/v1/speech_to_text", request.RequestUri!.ToString());
        Equal("zh", request.Headers.GetValues("language").Single());
        Equal("Bearer", request.Headers.Authorization?.Scheme);
        var parts = (MultipartFormDataContent)request.Content!;
        var fields = new Dictionary<string, string>();
        foreach (var part in parts) fields[part.Headers.ContentDisposition!.Name!.Trim('"')] = await part.ReadAsStringAsync();
        Equal("asr-1.0", fields["model"]);
        Equal("false", fields["stream"]);
        Equal("json", fields["response_format"]);
        Equal(true, fields.ContainsKey("file"));
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"text\":\"  这里的历史  \",\"duration\":1.2,\"trace_id\":\"fixture\"}") };
    }));
    var client = new MiniMaxSpeechToTextClient(new Factory(http), configuration);
    Equal("这里的历史", await client.TranscribeAsync(new MemoryStream(new byte[44]), "utterance.wav", "audio/wav", CancellationToken.None));
});
await Check("provider business error", () => Fails("{\"base_resp\":{\"status_code\":1001,\"status_msg\":\"fixture rejection\"}}", HttpStatusCode.OK, "fixture rejection"));
await Check("HTTP error", () => Fails("{}", HttpStatusCode.ServiceUnavailable, "HTTP 503"));
await Check("empty text", () => Fails("{\"text\":\"  \"}", HttpStatusCode.OK, "未返回识别文本"));
await Check("invalid JSON", () => Fails("invalid JSON", HttpStatusCode.OK, "未返回识别文本"));
await Check("cancellation propagated", async () => {
    using var http = new HttpClient(new Handler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") })));
    var client = new MiniMaxSpeechToTextClient(new Factory(http), configuration);
    using var cancellation = new CancellationTokenSource(); cancellation.Cancel();
    try {
        await client.TranscribeAsync(new MemoryStream(new byte[44]), "test.wav", "audio/wav", cancellation.Token);
        throw new Exception("Expected cancellation");
    } catch (OperationCanceledException) { }
});
if (args.Contains("--live")) {
    var liveConfiguration = new ConfigurationBuilder().AddJsonFile("D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System/CulturalTourismSystem.WebApi/appsettings.json").Build();
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
    var client = new MiniMaxSpeechToTextClient(new Factory(http), liveConfiguration);
    await using var wav = File.OpenRead("outputs/minimax-asr/fixture.wav");
    var text = await client.TranscribeAsync(wav, "fixture.wav", "audio/wav", CancellationToken.None);
    if (!text.Contains("历史")) throw new Exception("Live transcription did not match test phrase");
    Console.WriteLine($"PASS live server client: {text}"); passed++;
}
Console.WriteLine($"{passed}/{passed} checks passed");

sealed class Factory(HttpClient client) : IHttpClientFactory {
    public HttpClient CreateClient(string name) => client;
}
sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> respond) : HttpMessageHandler {
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
        token.ThrowIfCancellationRequested(); return respond(request);
    }
}
