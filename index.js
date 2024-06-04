const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');  // Built-in module, no need to install separately

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const LTI_KEY = 'amada';
const LTI_SECRET = 'enemiga';
const LTI_VERSION = 'LTI-1p0';

// Function to validate LTI launch request
const validateLtiRequest = (req) => {
    const oauth_consumer_key = req.body.oauth_consumer_key;
    const oauth_signature = req.body.oauth_signature;
    // Add more validations as needed
    return oauth_consumer_key === LTI_KEY && oauth_signature;
};

// Handle LTI launch request
app.post('/lti', (req, res) => {
    if (!validateLtiRequest(req)) {
        return res.status(401).send('Invalid LTI request');
    }
    // Extract LTI parameters
    const { user_id, roles, context_id, resource_link_id } = req.body;
    // Generate JWT token for content URL
    const token = jwt.sign({ user_id, roles, context_id, resource_link_id }, LTI_SECRET);
    // Redirect to the content URL with JWT token
    res.redirect(`/content?token=${token}`);
});

// Serve content URL
app.get('/content', (req, res) => {
    const token = req.query.token;
    try {
        const payload = jwt.verify(token, LTI_SECRET);
        // Serve the learning activity based on the payload
        res.type('html').send(`<html><body><h1>Welcome ${payload.user_id}</h1><p>Content for ${payload.resource_link_id}</p></body></html>`);
    } catch (error) {
        res.status(401).send('Invalid token');
    }
});

// Handle score passback
app.post('/score', async (req, res) => {
    const { score, lis_result_sourcedid, lis_outcome_service_url } = req.body;

    console.log('Score:', score);
    console.log('SourcedID:', lis_result_sourcedid);
    console.log('Outcome Service URL:', lis_outcome_service_url);

    const xml = `
        <imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0">
            <imsx_POXHeader>
                <imsx_POXRequestHeaderInfo>
                    <imsx_version>V1.0</imsx_version>
                    <imsx_messageIdentifier>${crypto.randomBytes(16).toString('hex')}</imsx_messageIdentifier>
                </imsx_POXRequestHeaderInfo>
            </imsx_POXHeader>
            <imsx_POXBody>
                <replaceResultRequest>
                    <resultRecord>
                        <sourcedGUID>
                            <sourcedId>${lis_result_sourcedid}</sourcedId>
                        </sourcedGUID>
                        <result>
                            <resultScore>
                                <language>en</language>
                                <textString>${score}</textString>
                            </resultScore>
                        </result>
                    </resultRecord>
                </replaceResultRequest>
            </imsx_POXBody>
        </imsx_POXEnvelopeRequest>
    `;

    console.log('XML:', xml);

    try {
        const response = await axios.post(lis_outcome_service_url, xml, {
            headers: { 'Content-Type': 'application/xml' },
        });
        res.type('json').send(response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        res.status(500).send('Error in score passback');
    }
});

app.listen(port, () => {
    console.log(`LTI tool server running on port ${port}`);
});
