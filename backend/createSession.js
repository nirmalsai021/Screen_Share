const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

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

    try {
        const sessionId = uuidv4();
        const ttl = Math.floor(Date.now() / 1000) + 3600; // 1 hour TTL

        await dynamodb.put({
            TableName: process.env.SESSIONS_TABLE,
            Item: {
                sessionId,
                createdAt: new Date().toISOString(),
                ttl,
                participants: []
            }
        }).promise();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ sessionId })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Failed to create session' })
        };
    }
};