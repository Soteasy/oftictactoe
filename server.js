const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const uri = "mongodb+srv://eg315-rop111:eg315@ofhelp.ga5giqb.mongodb.net/";
const client = new MongoClient(uri);

async function start() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error(err);
    }
}

app.post('/login', async (req, res) => {
    const key = req.body.key;

    if (!key) {
        res.status(500).send('Key not found!');
        return;
    }
    const collection = client.db("allInfo").collection("keys");
    const userDocument = await collection.findOne({ key: key });
    if (userDocument) {
        res.status(200).send({ userTag: userDocument.userTag });
        return;
    } else {
        res.status(500).send('Key not found!');
        return;
    }
});

app.get('/check_game', async (req, res) => {
    const userTag = req.body.userTag;
    const gameId = new ObjectId(req.body.gameId);
    const collection = client.db("tictactoe").collection("games");
    let gameDocument = await collection.findOne({ _id: gameId });
    if (!gameDocument) {
        gameDocument = await collection.findOne({ player1: userTag, $or: [{ status: 'waiting' }, { status: 'running' }] });
    }
    if (gameDocument) {  
        const oneMinuteAgo = Date.now() - 60 * 1000;
        if (gameDocument.lastMoveTime < oneMinuteAgo) {
                    gameDocument.status = 'won';
                    gameDocument.winner = gameDocument.currentPlayer === gameDocument.player1 ? gameDocument.player2 : gameDocument.player1;
                    await collection.updateOne({ _id: gameDocument._id }, { $set: { status: gameDocument.status, winner: gameDocument.winner } });
                    }
        res.status(200).send({ gameId: gameDocument._id.toString(), winner:gameDocument.winner,  winningCoordinates: gameDocument.winningCoordinates, status: gameDocument.status, board: gameDocument.board, player1Number: gameDocument.player1Number, player2Number: gameDocument.player2Number, player1: gameDocument.player1, player2: gameDocument.player2, currentPlayer: gameDocument.currentPlayer, lastMoveTime: gameDocument.lastMoveTime});
        return;
    } else {
        res.status(404).send('Game not found!');
        return;
    }
});

app.post('/leave_game', async (req, res) => {
    const userTag = req.body.userTag;
    const collection = client.db("tictactoe").collection("games");
    const gameDocuments = await collection.find({ $or: [{ player1: userTag }, { player2: userTag }], $or: [{ status: 'waiting' }, { status: 'running' }] }).toArray();
    if (gameDocuments.length > 0) {
        for (let gameDocument of gameDocuments) {
            const winner = gameDocument.player1 === userTag ? gameDocument.player2 : gameDocument.player1;
            const newStatus = gameDocument.status === 'running' ? 'finished' : 'cancelled';
            await collection.updateOne({ _id: gameDocument._id }, { $set: { status: newStatus, winner: winner } });
        }
        res.status(200).send('All games left!');
    } else {
        res.status(404).send('No games found!');
    }
});

app.post('/find_game', async (req, res) => {
    const userTag = req.body.userTag;
    const collection = client.db("tictactoe").collection("games");
    
    gameDocument = await collection.findOne({ player1: { $ne: userTag }, player2: { $exists: false }, status: 'waiting' });

    if (gameDocument) {
        const currentPlayer = gameDocument.player1Number > gameDocument.player2Number ? gameDocument.player1 : userTag;
        let player1Number, player2Number;
        do {
            player1Number = Math.floor(Math.random() * 101);
            player2Number = Math.floor(Math.random() * 101);
        } while (player1Number === player2Number);
        const lastMoveTime = Date.now();
        await collection.updateOne({ _id: gameDocument._id }, { $set: { player2: userTag, status: 'running', player1Number: player1Number, player2Number: player2Number, currentPlayer: currentPlayer, lastMoveTime: lastMoveTime } });
        res.status(200).send({ gameId: gameDocument._id.toString(), status: 'running', board: gameDocument.board, player1Number: player1Number, player2Number: player2Number, player1: gameDocument.player1, player2: userTag, currentPlayer: currentPlayer, lastMoveTime: lastMoveTime });
        return;
    } else {
        const result = await collection.insertOne({ player1: userTag, winner: "", status: 'waiting', board: Array(30).fill(Array(30).fill(' ')) });
        res.status(200).send({ gameId: result.insertedId.toString(), status: 'waiting', player1: userTag });
        return;
    }
});

app.post('/reconnect', async (req, res) => {
    const userTag = req.body.userTag;
    const gameId = new ObjectId
    (req.body.gameId);
    const collection = client.db("tictactoe").collection("games");
    const gameDocument = await collection.findOne({ _id: gameId, $or: [{ player1: userTag }, { player2: userTag }], status: 'running' });
    if (gameDocument) {
        res.status(200).send({board: gameDocument.board});
        return;
    } else {
        res.status(404).send('Game not found!');
        return;
    }
});

function checkWin(board, symbol) {
    for (let i = 0; i < 30; i++) {
        for (let j = 0; j < 30; j++) {
            let winningCoordinates = [];
            if (board[i][j] === symbol && board[i][j + 1] === symbol && board[i][j + 2] === symbol && board[i][j + 3] === symbol && board[i][j + 4] === symbol) {  // строка
                winningCoordinates.push([i, j], [i, j + 1], [i, j + 2], [i, j + 3], [i, j + 4]);
                return winningCoordinates;
            }
            if (board[i][j] === symbol && board[i + 1][j] === symbol && board[i + 2][j] === symbol && board[i + 3][j] === symbol && board[i + 4][j] === symbol) {  // столбец
                winningCoordinates.push([i, j], [i + 1, j], [i + 2, j], [i + 3, j], [i + 4, j]);
                return winningCoordinates;
            }
            if (board[i][j] === symbol && board[i + 1][j + 1] === symbol && board[i + 2][j + 2] === symbol && board[i + 3][j + 3] === symbol && board[i + 4][j + 4] === symbol) {  // диагональ вправо
                winningCoordinates.push([i, j], [i + 1, j + 1], [i + 2, j + 2], [i + 3, j + 3], [i + 4, j + 4]);
                return winningCoordinates;
            }
            if (board[i][j] === symbol && board[i + 1][j - 1] === symbol && board[i + 2][j - 2] === symbol && board[i + 3][j - 3] === symbol && board[i + 4][j - 4] === symbol) {  // диагональ влево
                winningCoordinates.push([i, j], [i + 1, j - 1], [i + 2, j - 2], [i + 3, j - 3], [i + 4, j - 4]);
                return winningCoordinates;
            }
        }
    }
    return false;
}

app.post('/make_move', async (req, res) => {
    const userTag = req.body.userTag;
    const x = req.body.x;
    const y = req.body.y;
    const symbol = req.body.symbol;
    const collection = client.db("tictactoe").collection("games");
    let gameDocument = await collection.findOne({ $or: [{ player1: userTag }, { player2: userTag }], $or: [{ status: 'waiting' }, { status: 'running' }] });
    if (gameDocument) {
        // Проверяем, что ход сделан текущим игроком
        if (gameDocument.currentPlayer !== userTag) {
            res.status(400).send('Not your turn');
            return;
        }
        // Проверяем, что клетка доски не содержит символ
        if (gameDocument.board[x][y] !== ' ') {
            res.status(400).send('Cell already occupied');
            return;
        }

        // Обновляем доску
        gameDocument.board[x][y] = symbol // Обновляем время последнего хода
        gameDocument.lastMoveTime = Date.now(); 
        let winningCoordinates = checkWin(gameDocument.board, symbol);
        if (winningCoordinates) {
            gameDocument.status = 'won';
            gameDocument.winner = userTag;
            gameDocument.winningCoordinates = winningCoordinates; // Добавляем координаты победной комбинации
        } else {
            // Меняем текущего игрока
            gameDocument.currentPlayer = gameDocument.currentPlayer === gameDocument.player1 ? gameDocument.player2 : gameDocument.player1;
        }
    
        await collection.updateOne({ _id: gameDocument._id }, { $set: { status: gameDocument.status, winner: gameDocument.winner, currentPlayer: gameDocument.currentPlayer, board: gameDocument.board, winningCoordinates: gameDocument.winningCoordinates, lastMoveTime: gameDocument.lastMoveTime } });
        res.status(200).send(gameDocument);
    } else {
        res.status(404).send('Game not found!');
    }
});




app.listen(3005, () => console.log('Server is running on port 3005'));
start();
