const db = require('../config/db');

exports.read = async (req, res) => {
    const { id } = req.params;
    try {
        // code
        const [rows] = await db.execute('SELECT movie_id, title, genre, duration, review, poster FROM movies WHERE movie_id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Movie not found'
            });
        }

        res.json({
            success: true,
            movie: rows[0]
        })
    } catch (err) {
        // error
        console.log(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
}

exports.list = async (req, res) => {
    try {
        // code
        const [rows] = await db.execute('SELECT movie_id, title, genre, duration, review, poster FROM movies ORDER BY created_at DESC');

        res.json({
            success: true,
            count: rows.length,
            movies: rows
        });
    } catch (err) {
        // error
        console.log(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
}

exports.create = async (req, res) => {
    const { title, genre, duration, poster, review = null } = req.body;

    // validate เบื้องต้น
    if (!title || !duration) {
        return res.status(400).json({
            success: false,
            error: 'title and duration are required'
        });
    }
    if (Number.isNaN(Number(duration))) {
        return res.status(400).json({
            success: false,
            error: 'duration must be a number'
        });
    }
    try {
        // code
        const [movie] = await db.execute('INSERT INTO movies (title, genre, duration, poster, review) VALUES (?, ?, ?, ?, ?)', [title, genre || null, Number(duration), poster || null, review]);

        res.status(201).json({
            success: true,
            message: 'Movie created successfully',
            movie: {
                id: movie.insertId,
                title,
                genre,
                duration,
                poster,
                review
            }
        });
    } catch (err) {
        // error
        console.log(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
}

exports.update = async (req, res) => {
    const { id } = req.params;
    const { title, genre, duration, poster, review = null} = req.body;

    if (!title || !duration) {
        return res.status(400).json({ 
            success: false, 
            error: 'title and duration are required' 
        });
    }
    if (Number.isNaN(Number(duration))) {
        return res.status(400).json({ 
            success: false, 
            error: 'duration must be a number' 
        });
    }

    try {
        // code
        const [result] = await db.execute('UPDATE movies SET title = ?, genre = ?, duration = ?, poster = ?, review = ? WHERE movie_id = ?', [title, genre || null, Number(duration), poster || null, review, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Movie not found'
            });
        }

        res.json({
            success: true,
            message: 'Movie updated successfully'
        });
    } catch (err) {
        // error
        console.log(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
}

exports.remove = async (req, res) => {
    const { id } = req.params;
    try {
        // code
        const [result] = await db.execute('DELETE FROM movies WHERE movie_id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Movie not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Movie deleted successfully'
        });
    } catch (err) {
        // error
        console.log(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
}

exports.search = async (req, res) => {
    const { title, genre } = req.query;
    if (!title && !genre) {
        return res.status(400).json({
            success: false,
            error: 'At least one of title or genre is required for search'
        });
    }
    try {
        // code
        let query = 'SELECT movie_id, title, genre, duration, review, poster FROM movies WHERE 1=1';
        const params = [];

        if (title) {
            query += ' AND title LIKE ?';
            params.push(`%${title}%`);
        }

        if (genre) {
            query += ' AND genre = ?';
            params.push(genre);
        }

        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            count: rows.length,
            movies: rows
        });
    } catch (err) {
        // error
        console.log(err);
        res.status(500).json({
            success: false,
            error: 'Server Error'
        });
    }
}