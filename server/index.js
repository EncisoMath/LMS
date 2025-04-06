// server/index.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
const studentRoutes = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');
const taskRoutes = require('./routes/tasks');
const gradeRoutes = require('./routes/grades');

app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/grades', gradeRoutes);

app.get('/', (req, res) => {
  res.send('¡Bienvenido a tu LMS personal!');
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
