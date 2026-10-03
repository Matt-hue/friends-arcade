using Npgsql;

namespace Arcade;

public record ScoreInput(string Game, string Player, int Score);
public record IdeaInput(string Author, string Text);

// One Map* method per feature keeps contributions easy to review.
public static class Features
{
    public static void MapScores(this WebApplication app)
    {
        app.MapGet("/api/scores/{game}", async (string game, NpgsqlDataSource ds) =>
        {
            await using var cmd = ds.CreateCommand(
                "SELECT player, score, created_at FROM scores WHERE game = $1 ORDER BY score DESC, created_at LIMIT 10");
            cmd.Parameters.AddWithValue(game);
            await using var r = await cmd.ExecuteReaderAsync();
            var list = new List<object>();
            while (await r.ReadAsync())
                list.Add(new { player = r.GetString(0), score = r.GetInt32(1), createdAt = r.GetDateTime(2) });
            return Results.Ok(list);
        });

        app.MapPost("/api/scores", async (ScoreInput s, NpgsqlDataSource ds) =>
        {
            var game = s.Game?.Trim() ?? "";
            var player = s.Player?.Trim() ?? "";
            if (game.Length is 0 or > 50 || player.Length is 0 or > 30 || s.Score < 0)
                return Results.BadRequest(new { error = "Invalid score" });
            await using var cmd = ds.CreateCommand("INSERT INTO scores (game, player, score) VALUES ($1, $2, $3)");
            cmd.Parameters.AddWithValue(game);
            cmd.Parameters.AddWithValue(player);
            cmd.Parameters.AddWithValue(s.Score);
            await cmd.ExecuteNonQueryAsync();
            return Results.Created($"/api/scores/{game}", null);
        });
    }

    public static void MapIdeas(this WebApplication app)
    {
        app.MapGet("/api/ideas", async (NpgsqlDataSource ds) =>
        {
            await using var cmd = ds.CreateCommand(
                "SELECT author, text, created_at FROM ideas ORDER BY created_at DESC LIMIT 50");
            await using var r = await cmd.ExecuteReaderAsync();
            var list = new List<object>();
            while (await r.ReadAsync())
                list.Add(new { author = r.GetString(0), text = r.GetString(1), createdAt = r.GetDateTime(2) });
            return Results.Ok(list);
        });

        app.MapPost("/api/ideas", async (IdeaInput i, NpgsqlDataSource ds) =>
        {
            var author = i.Author?.Trim() ?? "";
            var text = i.Text?.Trim() ?? "";
            if (author.Length is 0 or > 30 || text.Length is 0 or > 500)
                return Results.BadRequest(new { error = "Invalid idea" });
            await using var cmd = ds.CreateCommand("INSERT INTO ideas (author, text) VALUES ($1, $2)");
            cmd.Parameters.AddWithValue(author);
            cmd.Parameters.AddWithValue(text);
            await cmd.ExecuteNonQueryAsync();
            return Results.Created("/api/ideas", null);
        });
    }
}
