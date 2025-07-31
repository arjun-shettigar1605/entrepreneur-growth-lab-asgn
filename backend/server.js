const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const PORT = process.env.PORT || 5000;
require("dotenv").config();
const APIFY_API_BASE = "https://api.apify.com/v2";

app.use(cors());
app.use(express.json());

const makeRequest = async (endpoint, apiKey, meth = "GET", data = null) => {
  try {
    const config = {
      meth,
      url: `${APIFY_API_BASE}${endpoint}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    };
    if (data) {
      config.data = data;
    }
    const response = await axios(config);
    return { success: true, data: response.data };
  } 
  catch(error) {
    console.error("Apify API Error:", error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      status: error.response?.status || 500,
    };
  }
};

//validate api and fetch actor
app.post("/api/actors", async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "API key is required" });
  }

  const result = await makeRequest("/acts", apiKey);

  if (!result.success) {
    return res.status(result.status).json({ error: result.error });
  }

  
  const actors = result.data.data.items.map((actor) => ({
    id: actor.id,
    name: actor.name,
    title: actor.title || actor.name,
    description: actor.description,
    username: actor.username,
  }));

  res.json({ actors });
});

//actor schema
app.post("/api/actors/:actorId/schema", async (req, res) => {
  const { actorId } = req.params;
  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "API key is required" });
  }

  const result = await makeRequest(`/acts/${actorId}`, apiKey);

  if (!result.success) {
    return res.status(result.status).json({ error: result.error });
  }

  const actor = result.data.data;
  const inputSchema = actor.defaultRunOptions?.build?.inputSchema || {};

  res.json({
    schema: inputSchema,
    actorInfo: {
      name: actor.name,
      title: actor.title || actor.name,
      description: actor.description,
    },
  });
});

//execute
app.post("/api/actors/:actorId/run", async (req, res) => {
  const { actorId } = req.params;
  const { apiKey, input } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: "API key is required" });
  }


  const runResult = await makeRequest(`/acts/${actorId}/runs`, apiKey, "POST", input || {});

  if (!runResult.success) {
    return res.status(runResult.status).json({ error: runResult.error });
  }

  const runId = runResult.data.data.id;

  
  const maxAttempts = 60; 
  const pollInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const statusResult = await makeRequest(`/acts/${actorId}/runs/${runId}`, apiKey);

    if (!statusResult.success) {
      return res
        .status(statusResult.status)
        .json({ error: statusResult.error });
    }

    const run = statusResult.data.data;

    if (run.status === "SUCCEEDED") {
      const datasetResult = await makeRequest(`/datasets/${run.defaultDatasetId}/items`, apiKey);

      if (!datasetResult.success) {
        return res.json({
          status: "SUCCEEDED",
          runId,
          message: "Run completed successfully but could not fetch results",
          error: datasetResult.error,
        });
      }

      return res.json({
        status: "SUCCEEDED",
        runId,
        results: datasetResult.data.data,
        stats: run.stats,
      });
    } else if (run.status === "FAILED") {
      return res.json({
        status: "FAILED",
        runId,
        error: run.statusMessage || "Actor run failed",
        stats: run.stats,
      });
    } else if (run.status === "ABORTED") {
      return res.json({
        status: "ABORTED",
        runId,
        error: "Actor run was aborted",
        stats: run.stats,
      });
    }
    if (attempt === 0) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      });
      res.write(
        JSON.stringify({
          status: "RUNNING",
          runId,
          message: "Actor execution started...",
        }) + "\n"
      );
    }
  }
  return res.json({
    status: "TIMEOUT",
    runId,
    error: "Actor run timed out after 5 minutes",
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
