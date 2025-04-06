// server/routes/grades.js
const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Registrar calificación
router.post('/', (req, res) => {
  const { student_id, task_id, score } = req.body;
  if (!student_id || !task_id || score === undefined)
    return res.status(400).json({ error: 'Faltan datos' });

  const sql = 'INSERT INTO grades (student_id, task_id, score) VALUES (?, ?, ?)';
  db.run(sql, [student_id, task_id, score], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, student_id, task_id, score });
  });
});

// Ver calificaciones por estudiante
router.get('/estudiante/:student_id', (req, res) => {
  const { student_id } = req.params;
  const sql = `
    SELECT t.title, g.score
    FROM grades g
    JOIN tasks t ON g.task_id = t.id
    WHERE g.student_id = ?
  `;
  db.all(sql, [student_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Ver calificaciones por tarea
router.get('/tarea/:task_id', (req, res) => {
  const { task_id } = req.params;
  const sql = `
    SELECT s.name, g.score
    FROM grades g
    JOIN students s ON g.student_id = s.id
    WHERE g.task_id = ?
  `;
  db.all(sql, [task_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
