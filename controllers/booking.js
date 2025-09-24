// controllers/booking.js
const db = require('../config/db'); // mysql2/promise pool

// helpers
const toInt = (v) => Number.parseInt(v, 10);
const isPosInt = (v) => Number.isInteger(v) && v > 0;

// GET /bookings?user_id=&showtime_id=&status=
exports.list = async (req, res) => {
  try {
    const { user_id, showtime_id, status } = req.query;

    let sql = `
      SELECT b.booking_id, b.user_id, b.showtime_id, b.seats, b.seat_labels, b.status, b.booked_at,
             s.show_date, s.show_time,
             m.movie_id, m.title, m.poster
      FROM bookings b
      JOIN showtimes s ON s.showtime_id = b.showtime_id
      JOIN movies m    ON m.movie_id    = s.movie_id
      WHERE 1=1
    `;
    const params = [];
    if (user_id) { sql += ' AND b.user_id = ?'; params.push(user_id); }
    if (showtime_id) { sql += ' AND b.showtime_id = ?'; params.push(showtime_id); }
    if (status) { sql += ' AND b.status = ?'; params.push(status); }

    sql += ' ORDER BY b.booked_at DESC';

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, count: rows.length, bookings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// GET /bookings/:id
exports.read = async (req, res) => {
  const { id } = req.params; // booking_id
  try {
    const [rows] = await db.execute(
      `SELECT b.booking_id, b.user_id, b.showtime_id, b.seats, b.seat_labels, b.status, b.booked_at,
              s.show_date, s.show_time,
              m.movie_id, m.title, m.poster
       FROM bookings b
       JOIN showtimes s ON s.showtime_id = b.showtime_id
       JOIN movies m    ON m.movie_id    = s.movie_id
       WHERE b.booking_id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    res.json({ success: true, booking: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// POST /bookings  { user_id, showtime_id, seats, seat_labels? }
exports.create = async (req, res) => {
  try {
    let { user_id, showtime_id, seats, seat_labels = null } = req.body; // ⭐ NEW: seat_labels
    user_id = toInt(user_id);
    showtime_id = toInt(showtime_id);
    seats = toInt(seats);

    if (!isPosInt(user_id) || !isPosInt(showtime_id) || !isPosInt(seats)) {
      return res.status(400).json({ success: false, error: 'user_id, showtime_id and seats must be positive integers' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // ตรวจว่ามี showtime และล็อกบรรทัดนั้นไว้
      const [st] = await conn.execute(
        'SELECT available_seats FROM showtimes WHERE showtime_id = ? FOR UPDATE',
        [showtime_id]
      );
      if (st.length === 0) {
        await conn.rollback(); conn.release();
        return res.status(404).json({ success: false, error: 'Showtime not found' });
      }
      if (st[0].available_seats < seats) {
        await conn.rollback(); conn.release();
        return res.status(409).json({ success: false, error: 'Not enough seats' });
      }

      // กันที่นั่งไว้ทันที
      await conn.execute(
        'UPDATE showtimes SET available_seats = available_seats - ? WHERE showtime_id = ?',
        [seats, showtime_id]
      );

      // สร้าง booking (เริ่มที่ pending) + seat_labels
      const [result] = await conn.execute(
        'INSERT INTO bookings (user_id, showtime_id, seats, seat_labels, status) VALUES (?, ?, ?, ?, ?)',
        [user_id, showtime_id, seats, seat_labels, 'pending']    // ⭐ NEW: seat_labels
      );

      await conn.commit(); conn.release();

      res.status(201).json({
        success: true,
        message: 'Booking created (pending)',
        booking: {
          booking_id: result.insertId, user_id, showtime_id, seats,
          seat_labels, status: 'pending'                           // ⭐ NEW
        }
      });
    } catch (e) {
      await db.query('ROLLBACK');
      try { conn && conn.release(); } catch { }
      throw e;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// POST /bookings/:id/confirm
exports.confirm = async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT status FROM bookings WHERE booking_id = ? FOR UPDATE',
      [id]
    );
    if (rows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    const status = rows[0].status;
    if (status === 'cancelled') {
      await conn.rollback(); conn.release();
      return res.status(409).json({ success: false, error: 'Cannot confirm a cancelled booking' });
    }
    if (status === 'confirmed') {
      await conn.commit(); conn.release();
      return res.json({ success: true, message: 'Already confirmed' });
    }

    await conn.execute('UPDATE bookings SET status = ? WHERE booking_id = ?', ['confirmed', id]);
    await conn.commit(); conn.release();
    res.json({ success: true, message: 'Booking confirmed' });
  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch { }
    console.error(err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// POST /bookings/:id/cancel
exports.cancel = async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT showtime_id, seats, status FROM bookings WHERE booking_id = ? FOR UPDATE',
      [id]
    );
    if (rows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }
    const { showtime_id, seats, status } = rows[0];
    if (status === 'cancelled') {
      await conn.commit(); conn.release();
      return res.json({ success: true, message: 'Already cancelled' });
    }

    // เปลี่ยนสถานะ + คืนที่นั่ง
    await conn.execute('UPDATE bookings SET status = ? WHERE booking_id = ?', ['cancelled', id]);
    await conn.execute('UPDATE showtimes SET available_seats = available_seats + ? WHERE showtime_id = ?', [seats, showtime_id]);

    await conn.commit(); conn.release();
    res.json({ success: true, message: 'Booking cancelled and seats released' });
  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch { }
    console.error(err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// DELETE /bookings/:id
exports.remove = async (req, res) => {
  const { id } = req.params;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT showtime_id, seats, status FROM bookings WHERE booking_id = ? FOR UPDATE',
      [id]
    );
    if (rows.length === 0) {
      await conn.rollback(); conn.release();
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const { showtime_id, seats, status } = rows[0];

    if (status !== 'cancelled') {
      await conn.execute(
        'UPDATE showtimes SET available_seats = available_seats + ? WHERE showtime_id = ?',
        [seats, showtime_id]
      );
    }

    await conn.execute('DELETE FROM bookings WHERE booking_id = ?', [id]);
    await conn.commit(); conn.release();

    res.status(200).json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    try { await conn.rollback(); conn.release(); } catch { }
    console.error(err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// GET /users/:user_id/bookings?status=&from=&to=&page=&limit=
exports.historyByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    let { status = '', from = '', to = '', page = 1, limit = 20 } = req.query;

    page = Math.max(parseInt(page) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    let sql = `
      SELECT b.booking_id, b.user_id, b.showtime_id, b.seats, b.seat_labels, b.status, b.booked_at,
             s.show_date, s.show_time,
             m.movie_id, m.title, m.poster
      FROM bookings b
      JOIN showtimes s ON s.showtime_id = b.showtime_id
      JOIN movies m    ON m.movie_id    = s.movie_id
      WHERE b.user_id = ?
    `;
    const params = [user_id];

    if (status) { sql += ' AND b.status = ?'; params.push(status); }
    if (from) { sql += ' AND b.booked_at >= ?'; params.push(from); }
    if (to)   { sql += ' AND b.booked_at <= ?'; params.push(to); }

    sql += ' ORDER BY b.booked_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, page, limit, count: rows.length, bookings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

// GET /me/bookings...
exports.myHistory = async (req, res) => {
  req.params.user_id = req.user.id;
  return exports.historyByUser(req, res);
};
