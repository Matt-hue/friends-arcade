using Npgsql;

public record Score(string Name, int Points);

public interface IScoreStore
{
    Task InitAsync();
    Task AddAsync(Score score);
    Task<IReadOnlyList<Score>> TopAsync(int count);
}

// Used when no database is configured; scores are lost on restart.
public class MemoryScoreStore : IScoreStore
{
    private readonly List<Score> _scores = new();

    public Task InitAsync() => Task.CompletedTask;

    public Task AddAsync(Score score)
    {
        lock (_scores) _scores.Add(score);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<Score>> TopAsync(int count)
    {
        lock (_scores)
            return Task.FromResult<IReadOnlyList<Score>>(
                _scores.OrderByDescending(s => s.Points).Take(count).ToList());
    }
}

// Persistent store backed by the Clever Cloud PostgreSQL addon.
public class PostgresScoreStore : IScoreStore
{
    private readonly NpgsqlDataSource _db;

    public PostgresScoreStore(string connectionString) =>
        _db = NpgsqlDataSource.Create(connectionString);

    public async Task InitAsync()
    {
        await using var cmd = _db.CreateCommand(
            "CREATE TABLE IF NOT EXISTS scores (id SERIAL PRIMARY KEY, name TEXT NOT NULL, points INT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task AddAsync(Score score)
    {
        await using var cmd = _db.CreateCommand("INSERT INTO scores (name, points) VALUES ($1, $2)");
        cmd.Parameters.AddWithValue(score.Name);
        cmd.Parameters.AddWithValue(score.Points);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<IReadOnlyList<Score>> TopAsync(int count)
    {
        await using var cmd = _db.CreateCommand("SELECT name, points FROM scores ORDER BY points DESC, id LIMIT $1");
        cmd.Parameters.AddWithValue(count);
        var list = new List<Score>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync()) list.Add(new Score(r.GetString(0), r.GetInt32(1)));
        return list;
    }
}
