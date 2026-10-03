using Arcade;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(Db.ConnectionString(builder.Configuration)));

var app = builder.Build();
await Db.InitializeAsync(app.Services.GetRequiredService<NpgsqlDataSource>());

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapScores();
app.MapIdeas();

app.Run();

public partial class Program;
