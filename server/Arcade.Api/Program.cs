var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

const int MaxRetainedScores = 10_000;
var scores = new Queue<ScoreEntry>(MaxRetainedScores);
var scoresLock = new object();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/scores/{game}", (string game) =>
{
    ScoreEntry[] snapshot;
    lock (scoresLock)
        snapshot = scores.ToArray();

    return snapshot.Where(s => s.Game == game)
                   .OrderByDescending(s => s.Score)
                   .Take(10);
});

app.MapPost("/api/scores", (ScoreSubmission s) =>
{
    var name = s.Player?.Trim();
    var game = s.Game?.Trim();
    if (string.IsNullOrEmpty(name) || name.Length > 20 ||
        string.IsNullOrEmpty(game) || game.Length > 30 ||
        s.Score < 0 || s.Score > 1_000_000)
        return Results.BadRequest("Invalid score submission.");

    var entry = new ScoreEntry(game, name, s.Score, DateTime.UtcNow);
    lock (scoresLock)
    {
        if (scores.Count == MaxRetainedScores)
            scores.Dequeue();
        scores.Enqueue(entry);
    }
    return Results.Created($"/api/scores/{game}", entry);
});

app.MapFallbackToFile("index.html");

app.Run();

record ScoreSubmission(string? Game, string? Player, int Score);
record ScoreEntry(string Game, string Player, int Score, DateTime At);

public partial class Program { }
