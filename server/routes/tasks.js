// server/routes/tasks.js
const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Crear una nueva tarea
router.post('/', (req, res) => {
  const { title, grade, description } = req.body;
  if (!title || !grade) return res.status(400).json({ error: 'Faltan datos' });

  const sql = 'INSERT INTO tasks (title, grade, description) VALUES (?, ?, ?)';
  db.run(sql, [title, grade, description || ''], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, title, grade, description });
  });
});

// Ver todas las tareas
router.get('/', (req, res) => {
  db.all('SELECT * FROM tasks', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Ver tareas por grado
router.get('/grado/:grade', (req, res) => {
  const grade = req.params.grade;
  db.all('SELECT * FROM tasks WHERE grade = ?', [grade], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
    