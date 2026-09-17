const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const { auth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(auth);

app.use('/api', routes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(errorHandler);

module.exports = app;
