use tauri_plugin_sql::{Migration, MigrationKind};

/// Database schema changes, applied in order the first time the app sees them.
/// Never edit a migration that already shipped: add a new one instead.
/// (That's why version 1 still mentions 'rawg': games now use source = 'igdb'.)
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create items table",
        sql: "CREATE TABLE items (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            source      TEXT NOT NULL,              -- 'tmdb' | 'rawg'
            external_id TEXT NOT NULL,
            type        TEXT NOT NULL,              -- 'movie' | 'game'
            title       TEXT NOT NULL,
            year        INTEGER,
            poster_url  TEXT,
            genres      TEXT NOT NULL DEFAULT '[]', -- JSON array
            extra       TEXT NOT NULL DEFAULT '{}', -- JSON object (platforms, ...)
            status      TEXT NOT NULL,
            rating      INTEGER,
            favorite    INTEGER NOT NULL DEFAULT 0,
            notes       TEXT NOT NULL DEFAULT '',
            added_at    TEXT NOT NULL,
            fetched_at  TEXT NOT NULL,
            UNIQUE (source, external_id)
        );",
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:media-tracker.db", migrations())
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
