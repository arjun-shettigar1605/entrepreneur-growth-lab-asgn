import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

function App() {
  const [apiKey, setApiKey] = useState("");
  const [actors, setActors] = useState([]);
  const [selectedActor, setSelectedActor] = useState(null);
  const [schema, setSchema] = useState(null);
  const [input, setInput] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState("auth"); // auth, actors, schema, execute, results

  // Step 1: Authenticate and fetch actors
  const handleAuthenticate = async (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      setError("Please enter your Apify API key");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API_BASE}/actors`, { apiKey });
      setActors(response.data.actors);
      setStep("actors");
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to authenticate or fetch actors"
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Select actor and fetch schema
  const handleSelectActor = async (actor) => {
    setLoading(true);
    setError("");
    setSelectedActor(actor);

    try {
      const response = await axios.post(
        `${API_BASE}/actors/${actor.id}/schema`,
        { apiKey }
      );
      setSchema(response.data.schema);
      setInput({});
      setStep("schema");

      console.log("Schema received:", response.data.schema);
    } catch (err) {
      console.error("Schema fetch error:", err);
      setError(err.response?.data?.error || "Failed to fetch actor schema");
      // Still proceed to schema step even if schema fetch fails
      setSchema({});
      setStep("schema");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Execute actor
  const handleExecute = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await axios.post(
        `${API_BASE}/actors/${selectedActor.id}/run`,
        {
          apiKey,
          input,
        }
      );

      setResult(response.data);
      setStep("results");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to execute actor");
    } finally {
      setLoading(false);
    }
  };

  // Render input field based on schema property
  const renderInputField = (key, property) => {
    const value =
      input[key] || (property.default !== undefined ? property.default : "");

    const handleChange = (newValue) => {
      setInput((prev) => ({ ...prev, [key]: newValue }));
    };

    // Handle enum/select properties
    if (property.enum && Array.isArray(property.enum)) {
      return (
        <select value={value} onChange={(e) => handleChange(e.target.value)}>
          <option value="">-- Select an option --</option>
          {property.enum.map((option, index) => (
            <option key={option} value={option}>
              {property.enumTitles?.[index] || option}
            </option>
          ))}
        </select>
      );
    }

    switch (property.type) {
      case "boolean":
        return (
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => handleChange(e.target.checked)}
            />
            {property.title || key}
          </label>
        );

      case "integer":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(parseInt(e.target.value, 10) || 0)}
            placeholder={property.description}
            step={1}
            min={property.minimum}
            max={property.maximum}
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
            placeholder={property.description}
            step={0.01}
            min={property.minimum}
            max={property.maximum}
          />
        );

      case "array":
        const arrayValue = Array.isArray(value)
          ? value.join("\n")
          : value || "";
        return (
          <textarea
            value={arrayValue}
            onChange={(e) => {
              const lines = e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean);
              handleChange(lines);
            }}
            placeholder={`${
              property.description || "Enter one item per line"
            }\n\nExample:\nhttps://example.com\nhttps://google.com`}
            rows={6}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={property.description}
          />
        );
    }
  };

  const resetApp = () => {
    setStep("auth");
    setActors([]);
    setSelectedActor(null);
    setSchema(null);
    setInput({});
    setResult(null);
    setError("");
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🕷️ Apify Actor Runner</h1>
        <p>Execute your Apify actors with a simple, intuitive interface</p>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {/* Step 1: Authentication */}
        {step === "auth" && (
          <div className="step-container">
            <h2>🔐 Authenticate with Apify</h2>
            <form onSubmit={handleAuthenticate} className="auth-form">
              <div className="input-group">
                <label htmlFor="apiKey">Apify API Key</label>
                <input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Apify API key"
                  required
                />
                <small>
                  You can find your API key in your Apify account settings
                </small>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="primary-button"
              >
                {loading ? "Authenticating..." : "Connect to Apify"}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Actor Selection */}
        {step === "actors" && (
          <div className="step-container">
            <div className="step-header">
              <h2>🎭 Select an Actor</h2>
              <button onClick={resetApp} className="secondary-button">
                Change API Key
              </button>
            </div>

            {actors.length === 0 ? (
              <p className="no-actors">
                No actors found in your account. Create some actors in Apify
                first!
              </p>
            ) : (
              <div className="actors-grid">
                {actors.map((actor) => (
                  <div
                    key={actor.id}
                    className="actor-card"
                    onClick={() => handleSelectActor(actor)}
                  >
                    <h3>{actor.title}</h3>
                    <p className="actor-username">@{actor.username}</p>
                    {actor.description && (
                      <p className="actor-description">{actor.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Schema Input */}
        {step === "schema" && (
          <div className="step-container">
            <div className="step-header">
              <h2>⚙️ Configure {selectedActor.title}</h2>
              <button
                onClick={() => setStep("actors")}
                className="secondary-button"
              >
                Back to Actors
              </button>
            </div>

            {schema && Object.keys(schema).length > 0 && schema.properties ? (
              <div className="schema-form">
                <div className="form-fields">
                  {Object.entries(schema.properties).map(([key, property]) => (
                    <div key={key} className="field-group">
                      <label htmlFor={key}>
                        {property.title || key}
                        {schema.required?.includes(key) && (
                          <span className="required">*</span>
                        )}
                      </label>
                      {renderInputField(key, property)}
                      {property.description && (
                        <small className="field-description">
                          {property.description}
                        </small>
                      )}
                    </div>
                  ))}
                </div>

                <div className="form-actions">
                  <button
                    onClick={handleExecute}
                    disabled={loading}
                    className="primary-button execute-button"
                  >
                    {loading ? "Executing..." : "🚀 Execute Actor"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="no-schema-section">
                <p className="no-schema">
                  This actor doesn't have a defined input schema, but you can
                  still execute it with default settings.
                </p>
                <div className="form-actions">
                  <button
                    onClick={handleExecute}
                    disabled={loading}
                    className="primary-button execute-button"
                  >
                    {loading
                      ? "Executing..."
                      : "🚀 Execute Actor (Default Settings)"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Results */}
        {step === "results" && (
          <div className="step-container">
            <div className="step-header">
              <h2>📊 Execution Results</h2>
              <div className="result-actions">
                <button
                  onClick={() => setStep("schema")}
                  className="secondary-button"
                >
                  Run Again
                </button>
                <button
                  onClick={() => setStep("actors")}
                  className="secondary-button"
                >
                  Choose Different Actor
                </button>
              </div>
            </div>

            {result && (
              <div className="results-container">
                <div
                  className={`status-badge status-${result.status?.toLowerCase()}`}
                >
                  {result.status === "SUCCEEDED" && "✅ Success"}
                  {result.status === "FAILED" && "❌ Failed"}
                  {result.status === "RUNNING" && "⏳ Running"}
                  {result.status === "TIMEOUT" && "⏰ Timeout"}
                </div>

                {result.runId && (
                  <p className="run-id">
                    Run ID: <code>{result.runId}</code>
                  </p>
                )}

                {result.error && (
                  <div className="error-details">
                    <h3>Error Details</h3>
                    <pre>{result.error}</pre>
                  </div>
                )}

                {result.results && (
                  <div className="execution-results">
                    <h3>Results ({result.results.length} items)</h3>
                    <div className="results-data">
                      <pre>{JSON.stringify(result.results, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {result.stats && (
                  <div className="execution-stats">
                    <h3>Execution Stats</h3>
                    <div className="stats-grid">
                      {Object.entries(result.stats).map(([key, value]) => (
                        <div key={key} className="stat-item">
                          <span className="stat-label">{key}:</span>
                          <span className="stat-value">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Processing...</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
