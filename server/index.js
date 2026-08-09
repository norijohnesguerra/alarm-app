import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import alarmRoutes from './routes/alarms.js';
import tagRoutes from './routes/tags.js';
import memoRoutes from './routes/memos.js';
import workdayRoutes from './routes/workday.js';
import arcRoutes from './routes/arcs.js';
import dayEventRoutes from './routes/dayEvents.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/alarms', alarmRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/memos', memoRoutes);
app.use('/api/workday', workdayRoutes);
app.use('/api/arcs', arcRoutes);
app.use('/api/day-events', dayEventRoutes);

app.listen(PORT, () => {
  console.log(`Neon Alarm API running on http://localhost:${PORT}`);
});
