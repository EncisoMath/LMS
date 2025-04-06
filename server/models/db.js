// server/models/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta a la base de datos (puede quedar como lms.db en el servidor)
const dbPath = path.resolve(__dirname, '../../lms.db');
const db = new sqlite3.Database(dbPath);

// Crear tablas si no existen
db.serialize(() => {
  // Estudiantes
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      grade TEXT NOT NULL
    )
  `);

  // Asistencia
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      date TEXT,
      present INTEGER,
      FOREIGN KEY(student_id) REFERENCES students(id)
    )
  `);

  // Tareas
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
