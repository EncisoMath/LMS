// server/routes/students.js
const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Crear nuevo estudiante
router.post('/', (req, res) => {
  const { name, grade } = req.body;
  if (!name || !grade) return res.status(400).json({ error: 'Faltan datos' });

  const sql = 'INSERT INTO students (name, grade) VALUES (?, ?)';
  db.run(sql, [name, grade], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, name, grade });
  });
});

// Obtener todos los estudiantes
router.get('/', (req, res) => {
  db.all('SELECT * FROM students', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Obtener estudiantes por grado
router.get('/grado/:grade', (req, res) => {
  const grade = req.params.grade;
  db.all('SELECT * FROM students WHERE grade = ?', [grade], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
