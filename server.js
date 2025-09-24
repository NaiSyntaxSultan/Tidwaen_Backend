const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const bodyParser = require('body-parser');

const { readdirSync } = require('fs');

const app = express();



app.use(morgan('dev'));
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Route
readdirSync('./routes').map((r) => app.use('/api', require('./routes/' + r)));




app.listen(5000, () => {
    console.log('Server is running on port 5000');
});