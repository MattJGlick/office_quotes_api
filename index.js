var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var pg = require('pg');
var swaggerDoc = require('./swagger.json');
var swaggerTools = require('swagger-tools');

swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
    // Serve the Swagger documents and Swagger UI
    app.use(middleware.swaggerUi());
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 3000;
var connString = process.env.POSTGRES_STRING;

const INSERT_QUOTE_STRING = 'INSERT INTO quotes (quote, author, submitter) VALUES ($1, $2, $3);'
const GET_RANDOM_QUOTE_STRING = 'SELECT quote, author FROM quotes OFFSET floor(random()*(SELECT COUNT(*) FROM quotes)) LIMIT 1;'
const GET_ALL_QUOTES_STRING = 'SELECT quote, author FROM quotes;'
const CHECK_API_KEY_STRING = 'SELECT id FROM api_keys WHERE api_key = $1;'

const client = new pg.Client(connString);
client.connect();

// ROUTES FOR OUR API
// // =============================================================================
var router = express.Router();             

// middleware to use for all requests
router.use(function(req, res, next) {
    var token = req.body.token || req.query.token || req.headers['token'];

    client.query(CHECK_API_KEY_STRING, [token], function(err, result) {
        user_id = result.rows[0]

        if (user_id) {
            req.user_id = user_id.id

            next();
        } else {
            return res.status(401).send({ 
                success: false, 
                message: "bad token"
            });
        }
    })
});

router.route('/quotes')
    .get(function(req, res, next) {
        client.query(GET_ALL_QUOTES_STRING, function (err, result) {
            if (err) return next(err);

            res.status(200)
                .json({
                    status: 'success',
                    data: result.rows,
                });
        });
    });

router.route('/quote')
    .post(function(req, res, next) {
        quote = req.body.quote; 
        author = req.body.author; 
        submitter = req.user_id; 

        if (quote && author && submitter) {
            client.query(INSERT_QUOTE_STRING, [quote, author, submitter], function (err, result) {
                if (err) return next(err);

                res.status(200)
                    .json({
                        status: 'success',
                        message: "inserted quote"
                    });
            });
        } else {
            res.status(422)
                .json({
                    status: false,
                    message: "missing something"
                });
        }
    })

    .get(function(req, res, next) {
        client.query(GET_RANDOM_QUOTE_STRING, function (err, result) {
            if (err) return next(err);

            res.status(200)
                .json({
                    status: 'success',
                    quote: result.rows[0],
                });
        });
    });

router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });
});

app.use('/api', router);

app.listen(port);
console.log('Live on port ' + port);
