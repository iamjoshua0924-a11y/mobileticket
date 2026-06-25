function staffAuth(req, res, next) {
  const expected = process.env.STAFF_SECRET;
  if (!expected) {
    return res.status(500).json({ message: 'STAFF_SECRET is not configured' });
  }

  const got = req.header('x-staff-secret');
  if (!got || got !== expected) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return next();
}

module.exports = { staffAuth };

