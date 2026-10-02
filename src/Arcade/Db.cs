using Npgsql;

namespace Arcade;

public static class Db
{
    // Clever Cloud PostgreSQL addons expose POSTGRESQL_ADDON_* variables.
    public static string ConnectionString(IConfiguration config)
    {
        var uri = config["POSTGRESQL_ADDON_URI"];
        if (!string.IsNullOrWhiteSpace(uri))
        {
            var u = new Uri(uri);
            var info = u.UserInfo.Split(':', 2);
            return new NpgsqlConnectionStringBuilder
            {
                Host = u.Host,
                Port = u.Port > 0 ? u.Port : 5432,
                Database = u.AbsolutePath.TrimStart('/'),
                Username = Uri.UnescapeDataString(info[0]),
                Password = info.Length > 1 ? Uri.UnescapeDataString(info[1]) : null,
                SslMode = SslMode.Prefer,
            }.ConnectionString;
        }

        var host = config["POSTGRESQL_ADDON_HOST"];
        if (!string.IsNullOrWhiteSpace(host))
        {
            return new NpgsqlConnectionStringBuilder
            {
                Host = host,
                Port = int.TryParse(config["POSTGRESQL_ADDON_PORT"], out var p) ? p : 5432,
                Database = config["POSTGRESQL_ADDON_DB"],
                Username = config["POSTGRESQL_ADDON_USER"],
                Password = config["POSTGRESQL_ADDON_PASSWORD"],
                SslMode = SslMode.Prefer,
            }.ConnectionString;
        }

        return config.GetConnectionString("Default")
            ?? throw new InvalidOperationException(
                "No database configured. Set POSTGRESQL_ADDON_URI (Clever Cloud) or ConnectionStrings__Default.");
    }

    // Startup schema creation. Add new tables here with CREATE TABLE IF NOT EXISTS.
    public const string Schema = """
        CREATE TABLE IF NOT EXISTS scores (
            id SERIAL PRIMARY KEY,
            game TEXT NOT NULL,
            player TEXT NOT NULL,
            score INT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS ix_scores_game_score ON scores (game, score DESC);
        CREATE TABLE IF NOT EXISTS ideas (
            id SERIAL PRIMARY KEY,
            author TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """;

    public static async Task InitializeAsync(NpgsqlDataSource ds)
    {
        await using var cmd = ds.CreateCommand(Schema);
        await cmd.ExecuteNonQueryAsync();
    }
}
