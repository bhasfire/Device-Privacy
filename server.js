require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const app = express();
const port = 5001;
app.use(cors());
app.use(express.json()); // Parse JSON request body

// Setup AWS DynamoDB Client
const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

app.get('/api/privacy-score/:appName', async (req, res) => {
    const { appName } = req.params;

    try {
        const data = await docClient.send(new GetCommand({
            TableName: 'DevicePrivacy',
            Key: { appName }
        }));

        if (!data.Item) {
            return res.status(404).json({ message: 'App not found' });
        }

        res.json(data.Item);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to retrieve data' });
    }
});

app.get('/api/privacy-scores', async (req, res) => {
    try {
        const data = await docClient.send(new ScanCommand({ TableName: 'DevicePrivacy' }));
        res.json(data.Items);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to retrieve data' });
    }
});

app.post('/api/privacy-score', async (req, res) => {
    const { appName, score, category } = req.body;

    if (!appName || !score) {
        return res.status(400).json({ error: 'appName and score are required' });
    }

    try {
        await docClient.send(new PutCommand({
            TableName: 'DevicePrivacy',
            Item: { appName, score, category }
        }));

        res.json({ message: 'Privacy score added successfully' });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
