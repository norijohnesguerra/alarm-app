import { Router } from 'express';
import { getDb, queryOne, run } from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/:tagId', async (req, res) => {
  await getDb();
  const tag = queryOne('SELECT * FROM tags WHERE id = ? AND user_id = ?', [req.params.tagId, req.user.id]);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });

  const memo = queryOne('SELECT * FROM memos WHERE tag_id = ?', [req.params.tagId]);
  res.json(memo || { tag_id: Number(req.params.tagId), content: '' });
});

router.put('/:tagId', async (req, res) => {
  await getDb();
  const tag = queryOne('SELECT * FROM tags WHERE id = ? AND user_id = ?', [req.params.tagId, req.user.id]);
  if (!tag) return res.status(404).json({ error: 'Tag not found' });

  const { content } = req.body;
  const existing = queryOne('SELECT * FROM memos WHERE tag_id = ?', [req.params.tagId]);

  if (existing) {
    run('UPDATE memos SET content = ?, updated_at = datetime(\'now\') WHERE tag_id = ?', [content ?? existing.content, req.params.tagId]);
  } else {
    run('INSERT INTO memos (tag_id, content) VALUES (?, ?)', [req.params.tagId, content || '']);
  }

  const memo = queryOne('SELECT * FROM memos WHERE tag_id = ?', [req.params.tagId]);
  res.json(memo);
});

export default router;
