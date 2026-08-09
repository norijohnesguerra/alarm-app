import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, queryOne, queryAll, run, saveDb } from '../db/init.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    await getDb();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash]);
    const user = queryOne('SELECT id, email FROM users WHERE email = ?', [email]);
    const userId = user.id;

    const defaultTags = [
      { name: 'Recurring', color: '#ff4081', categories: 'recurring', is_recurring: 1 },
      { name: 'Work', color: '#00e5ff', categories: 'work' },
      { name: 'Personal', color: '#ff00ff', categories: 'personal' },
      { name: 'Recreational', color: '#76ff03', categories: 'recreational' },
    ];

    for (const tag of defaultTags) {
      run('INSERT INTO tags (user_id, name, color, categories, is_recurring, is_system_default) VALUES (?, ?, ?, ?, ?, 1)', [userId, tag.name, tag.color, tag.categories, tag.is_recurring || 0]);
      const createdTag = queryOne('SELECT id FROM tags WHERE user_id = ? AND name = ?', [userId, tag.name]);
      run('INSERT INTO memos (tag_id, content) VALUES (?, ?)', [createdTag.id, '']);
    }

    run('INSERT INTO work_schedules (user_id) VALUES (?)', [userId]);

    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    await getDb();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
