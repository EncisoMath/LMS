// server/routes/attendance.js
const express = require('express');
const router = express.Router();
const db = require('../models/db');

// Registrar asistencia
router.post('/', (req, res) => {
  const { student_id, date, present } = req.body;
  if (!student_id || !date || present === undefined)
    return res.status(400).json({ error: 'Datos incompletos' });

  const sql = 'INSERT INTO attendance (student_id, date, present) VALUES (?, ?, ?)';
  db.run(sql, [student_id, date, present], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, student_id, date, present });
  });
});

// Ver asistencia de un estudiante
router.get('/estudiante/:student_id', (req, res) => {
  const { student_id } = req.params;
  const sql = 'SELECT * FROM attendance WHERE student_id = ?';
  db.all(sql, [student_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Ver asistencia de un grado por fecha
router.get('/grado/:grade/:date', (req, res) => {
  const { grade, date } = req.params;
  const sql = `
    SELECT s.name, a.date, a.present
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ?
    WHERE s.grade = ?
  `;
  db.all(sql, [date, grade], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router
