using Npgsql;

var builder = WebApplication.CreateBuilder(args);

// Clever Cloud injects POSTGRESQL_ADDON_URI when a PostgreSQL addon is linked.
var dbUrl = builder.Configuration["POSTGRESQL_ADDON_URI"]
    ?? builder.Configuration.GetConnectionString("Default");

IScoreStore store;
if (string.IsNullOrWhiteSpace(dbUrl))
{
    store = new MemoryScoreStore();
}
else
{
    var csb = new NpgsqlConnectionStringBuilder();
    if (Uri.TryCreate(dbUrl, UriKind.Absolute, out var uri) && uri.Scheme.StartsWith("postgres"))
    {
        var userInfo = uri.UserInfo.Split(':', 2);
        csb.Host = uri.Host;
        csb.Port = uri.Port > 0 ? uri.Port : 5432;
        csb.Database = uri.AbsolutePath.TrimStart('/');
        csb.Username = Uri.UnescapeDataString(userInfo[0]);
        if (userInfo.Length > 1) csb.Password = Uri.UnescapeDataString(userInfo[1]);
    }
    else
    {
        csb.ConnectionString = dbUrl;
    }
    store = new PostgresScoreStore(csb.ConnectionString);
}
builder.Services.AddSingleton(store);

var app = builder.Build();
await store.InitAsync();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/scores", async (IScoreStore s) => await s.TopAsync(10));

app.MapPost("/api/scores", async (Score score, IScoreStore s) =>
{
    var name = (score.Name ?? "").Trim();
    if (name.Length is 0 or > 20 || score.Points is < 0 or > 1_000_000)
        return Results.BadRequest("Invalid score.");
    await s.AddAsync(new Score(name, score.Points));
    return Results.Created("/api/scores", null);
});

app.Run();
