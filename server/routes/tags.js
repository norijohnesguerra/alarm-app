import { Router } from 'express';
import { getDb, queryAll, queryOne, run } from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function colorDistance(c1, c2) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function findSimilarColor(color, existingColors, threshold = 60) {
  for (const existing of existingColors) {
    if (colorDistance(color, existing) < threshold) return existing;
  }
  return null;
}

router.get('/', async (req, res) => {
  await getDb();
  const tags = queryAll('SELECT * FROM tags WHERE user_id = ? ORDER BY is_system_default DESC, name', [req.user.id]);
  const normalized = tags.map(t => ({ ...t, categories: t.categories || 'custom' }));
  res.json(normalized);
});

router.post('/', async (req, res) => {
  await getDb();
  const { name, color, categories } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const allTags = queryAll('SELECT color FROM tags WHERE user_id = ?', [req.user.id]);
  const existingColors = allTags.map(t => t.color);
  const newColor = color || '#00ffff';

  if (existingColors.includes(newColor)) {
    return res.status(409).json({ error: 'Color already in use by another tag' });
  }
  const similar = findSimilarColor(newColor, existingColors);
  if (similar) {
    return res.status(409).json({ error: `Color too similar to ${similar}. Choose a more distinct color.` });
  }

  try {
    const cats = Array.isArray(categories) ? categories.join(',') : (categories || 'custom');
    run('INSERT INTO tags (user_id, name, color, categories) VALUES (?, ?, ?, ?)', [req.user.id, name, newColor, cats]);
    const tag = queryOne('SELECT * FROM tags WHERE user_id = ? AND name = ? ORDER BY id DESC LIMIT 1', [req.user.id, name]);
    run('INSERT INTO memos (tag_id, content) VALUES (?, ?)', [tag.id, '']);
    res.status(201).json({ ...tag, categories: tag.categories || 'custom' });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Tag name already exists' });
    throw err;
  }
});

router.put('/:id', async (req, res) => {
  await getDb();
  const { name, color, categories, is_recurring } = req.body;
  const existing = queryOne('SELECT * FROM tags WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'Tag not found' });

  if (color && color !== existing.color) {
    const allTags = queryAll('SELECT color FROM tags WHERE user_id = ? AND id != ?', [req.user.id, req.params.id]);
    const existingColors = allTags.map(t => t.color);

    if (existingColors.includes(color)) {
      return res.status(409).json({ error: 'Color already in use by another tag' });
    }
    const similar = findSimilarColor(color, existingColors);
    if (similar) {
      return res.status(409).json({ error: `Color too similar to ${similar}. Choose a more distinct color.` });
    }
  }

  const cats = Array.isArray(categories) ? categories.join(',') : (categories ?? existing.categories);
  run('UPDATE tags SET name = ?, color = ?, categories = ?, is_recurring = ? WHERE id = ?',
    [name ?? existing.name, color ?? existing.color, cats, is_recurring ?? existing.is_recurring, req.params.id]);
  const tag = queryOne('SELECT * FROM tags WHERE id = ?', [req.params.id]);
  res.json({ ...tag, categories: tag.categories || 'custom' });
});

router.delete('/:id', async (req, res) => {
  await getDb();
  const tag = queryOne('SELECT * FROM tags WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });
  if (tag.is_system_default) return res.status(400).json({ error: 'Cannot delete default tags' });

  const arcIds = queryAll('SELECT id FROM arcs WHERE tag_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  for (const arc of arcIds) {
    run('DELETE FROM alarms WHERE arc_id = ? AND user_id = ?', [arc.id, req.user.id]);
  }
  run('DELETE FROM tags WHERE id = ?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

export default router;
