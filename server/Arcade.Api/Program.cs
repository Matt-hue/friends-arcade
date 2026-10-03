using System.Collections.Concurrent;
using System.Security.Cryptography;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

const int MaxRetainedScores = 10_000;
var scores = new Queue<ScoreEntry>(MaxRetainedScores);
var scoresLock = new object();
var rooms = new ConcurrentDictionary<string, MultiplayerRoom>();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapPost("/api/rooms", () =>
{
    foreach (var expired in rooms.Where(pair => pair.Value.ExpiresAt <= DateTime.UtcNow))
        rooms.TryRemove(expired.Key, out _);

    string code;
    do
    {
        code = string.Create(6, 0, (chars, _) =>
        {
            const string alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
            for (var i = 0; i < chars.Length; i++)
                chars[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
        });
    } while (rooms.ContainsKey(code));

    var room = new MultiplayerRoom(code);
    rooms[code] = room;
    return Results.Ok(room.Snapshot());
});

app.MapPost("/api/rooms/{code}/players", (string code, PlayerRequest request) =>
{
    if (!TryGetRoom(code, out var room))
        return Results.NotFound("Room not found or expired.");

    var name = request.Name?.Trim();
    if (string.IsNullOrEmpty(name) || name.Length > 20)
        return Results.BadRequest("Player name must be between 1 and 20 characters.");

    lock (room)
    {
        var player = room.Players.FirstOrDefault(p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (player is null)
        {
            if (room.Players.Count >= 8)
                return Results.Conflict("This room is full.");
            player = new MultiplayerPlayer(name);
            room.Players.Add(player);
        }
        return Results.Ok(room.Snapshot());
    }
});

app.MapPost("/api/rooms/{code}/hits", (string code, PlayerRequest request) =>
{
    if (!TryGetRoom(code, out var room))
        return Results.NotFound("Room not found or expired.");

    var name = request.Name?.Trim();
    lock (room)
    {
        if (room.Finished)
            return Results.Conflict("This game has ended.");
        var player = room.Players.FirstOrDefault(p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (player is null)
            return Results.BadRequest("Join the room before playing.");
        player.Score++;
        room.Score++;
        return Results.Ok(room.Snapshot());
    }
});

app.MapGet("/api/rooms/{code}", (string code) =>
{
    if (!TryGetRoom(code, out var room))
        return Results.NotFound("Room not found or expired.");
    lock (room)
        return Results.Ok(room.Snapshot());
});

app.MapPost("/api/rooms/{code}/finish", (string code) =>
{
    if (!TryGetRoom(code, out var room))
        return Results.NotFound("Room not found or expired.");
    lock (room)
    {
        room.Finished = true;
        return Results.Ok(room.Snapshot());
    }
});

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

bool TryGetRoom(string code, out MultiplayerRoom room)
{
    if (rooms.TryGetValue(code.ToUpperInvariant(), out room!) && room.ExpiresAt > DateTime.UtcNow)
        return true;
    rooms.TryRemove(code.ToUpperInvariant(), out _);
    room = null!;
    return false;
}

record ScoreSubmission(string? Game, string? Player, int Score);
record ScoreEntry(string Game, string Player, int Score, DateTime At);
record PlayerRequest(string? Name);
record RoomPlayer(string Name, int Score);
record RoomSnapshot(string Code, int Score, bool Finished, IReadOnlyList<RoomPlayer> Players);

sealed class MultiplayerRoom(string code)
{
    public string Code { get; } = code;
    public int Score { get; set; }
    public bool Finished { get; set; }
    public DateTime ExpiresAt { get; } = DateTime.UtcNow.AddMinutes(30);
    public List<MultiplayerPlayer> Players { get; } = [];

    public RoomSnapshot Snapshot() => new(
        Code,
        Score,
        Finished,
        Players.Select(player => new RoomPlayer(player.Name, player.Score))
               .OrderByDescending(player => player.Score)
               .ThenBy(player => player.Name)
               .ToArray());
}

sealed class MultiplayerPlayer(string name)
{
    public string Name { get; } = name;
    public int Score { get; set; }
}

public partial class Program { }
