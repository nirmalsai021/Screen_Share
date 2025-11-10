const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const sessionId = event.pathParameters.sessionId;
    const { type, data } = JSON.parse(event.body);

    try {
        // Verify session exists
        const session = await dynamodb.get({
            TableName: process.env.SESSIONS_TABLE,
            Key: { sessionId }
        }).promise();

        if (!session.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({ error: 'Session not found' })
            };
        }

        // Store signaling data temporarily (in real app, use WebSocket API)
        const signalId = `${sessionId}-${Date.now()}`;
        await dynamodb.put({
            TableName: process.env.SESSIONS_TABLE,
            Item: {
                sessionId: signalId,
                type,
                data,
                ttl: Math.floor(Date.now() / 1000) + 300 // 5 minutes TTL
            }
        }).promise();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Signaling failed' })
        };
    }
};