import React, { useState, useEffect, useCallback } from "react";
import "./css/index.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3001";

function App() {
  // State for project data
  const [filteredProjects, setFilteredProjects] = useState([]);

  // Filter options from backend
  const [filterOptions, setFilterOptions] = useState({
    cases: [],
    issues: [],
    ideas: [],
    ecology: [],
    governance: [],
    economic: [],
    socio_cultural: [],
    upgrading: [],
  });

  // Current filter settings
  const [filters, setFilters] = useState({
    issue: "",
    idea: "",
    ecology: "",
    governance: "",
    economic: "",
    socio_cultural: "",
    upgrading: "",
    latitude: "",
    longitude: "",
    radius_km: "",
  });

  // UI status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Define fetchProjects BEFORE it's used in useEffect
  const fetchProjects = useCallback(async () => {
    try {
      // Create URL parameters for filters
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.toString().trim()) {
          params.append(key, value);
        }
      });

      const url = `${API_URL}/api/projects${
        params.toString() ? "?" + params : ""
      }`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      setFilteredProjects(data);
    } catch (err) {
      console.error("Error fetching filtered projects:", err);
      setError("Error filtering projects: " + err.message);
    }
  }, [filters]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Load both projects and filter options in parallel
      const [projectsResponse, optionsResponse] = await Promise.all([
        fetch(`${API_URL}/api/projects`),
        fetch(`${API_URL}/api/filter-options`),
      ]);

      if (!projectsResponse.ok || !optionsResponse.ok) {
        throw new Error("Failed to load data from server");
      }

      const projectsData = await projectsResponse.json();
      const optionsData = await optionsResponse.json();

      setFilteredProjects(projectsData);
      setFilterOptions(optionsData);
      setError(null);
    } catch (err) {
      setError("Error loading data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data on first render
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Reload projects when filters change
  useEffect(() => {
    if (!loading) {
      fetchProjects();
    }
  }, [filters, loading, fetchProjects]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      issue: "",
      idea: "",
      ecology: "",
      governance: "",
      economic: "",
      socio_cultural: "",
      upgrading: "",
      latitude: "",
      longitude: "",
      radius_km: "",
    });
  };

  // Format date (PostGIS uses ISO format)
  const formatDate = (dateString) => {
    if (!dateString) return "Not specified";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  // Display coordinates in user-friendly format with correct N/S/E/W
  const formatCoordinates = (lat, lng) => {
    if (!lat || !lng) return "No coordinates";

    const latitude = Number(lat);
    const longitude = Number(lng);

    // Determine direction based on positive/negative values
    const latDirection = latitude >= 0 ? "N" : "S";
    const lngDirection = longitude >= 0 ? "E" : "W";

    // Use absolute values to remove negative signs
    const latValue = Math.abs(latitude).toFixed(4);
    const lngValue = Math.abs(longitude).toFixed(4);

    return `${latValue}°${latDirection}, ${lngValue}°${lngDirection}`;
  };

  // Show project details
  const showProjectDetails = async (projectId) => {
    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}`);
      if (!response.ok) throw new Error("Project not found");

      const project = await response.json();
      setSelectedProject(project);
    } catch (err) {
      console.error("Error fetching project details:", err);
      alert("Error loading project details");
    }
  };

  // Component to render factor tags
  const FactorTags = ({ factors, maxShow = 3, className = "" }) => {
    if (!factors || factors.length === 0)
      return <span className="no-factors">None specified</span>;

    const displayFactors = factors.slice(0, maxShow);
    const remainingCount = factors.length - maxShow;

    return (
      <div className={`factor-tags ${className}`}>
        {displayFactors.map((factor, index) => (
          <span
            key={factor.id || index}
            className="factor-tag"
            title={factor.description}
          >
            {factor.name}
          </span>
        ))}
        {remainingCount > 0 && (
          <span
            className="factor-tag more-factors"
            title={`${remainingCount} more factors`}
          >
            +{remainingCount}
          </span>
        )}
      </div>
    );
  };

  // Component to render detailed factor sections
  const FactorSection = ({ title, factors, icon, colorClass }) => {
    if (!factors || factors.length === 0) return null;

    return (
      <div className={`detail-section ${colorClass}`}>
        <h3>
          {icon} {title}
        </h3>
        <div className="factor-list">
          {factors.map((factor, index) => (
            <div key={factor.id || index} className="factor-item">
              <h4>{factor.name}</h4>
              {factor.description && (
                <p className="factor-description">{factor.description}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Get primary factors for card display (first item of each array)
  const getPrimaryFactors = (project) => {
    return {
      issue:
        project.issues && project.issues.length > 0
          ? project.issues[0].name
          : "Not specified",
      idea:
        project.ideas && project.ideas.length > 0
          ? project.ideas[0].name
          : "Not specified",
      ecology:
        project.ecology_factors && project.ecology_factors.length > 0
          ? project.ecology_factors[0].name
          : "Not specified",
      governance:
        project.governance_types && project.governance_types.length > 0
          ? project.governance_types[0].name
          : "Not specified",
    };
  };

  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading river restoration projects...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="error-container">
        <h2>Error Occurred</h2>
        <p>{error}</p>
        <button onClick={fetchInitialData} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>River Restoration Projects</h1>
        <p>
          Discover innovative river restoration projects and their impact on
          ecology, society, and economy
        </p>
      </header>

      {/* Filter Section */}
      <div className="filters">
        <div className="filters-header">
          <h3>Filters & Search</h3>
          <div className="filter-actions">
            <button className="clear-filters" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        </div>
        
        <div 
          className="filter-toggle-section"
          onClick={() => setShowFilters(!showFilters)}
        >
          <span className="toggle-text">
            {showFilters ? 'Hide filter options' : 'Show filter options'}
          </span>
          <div className={`expand-arrow ${showFilters ? 'expanded' : ''}`}>
            ▼
          </div>
        </div>

        {showFilters && (
          <div className="filter-grid">
            <div className="filter-group">
              <label>Issue/Problem:</label>
              <select
                value={filters.issue}
                onChange={(e) => handleFilterChange("issue", e.target.value)}
              >
                <option value=""></option>
                {filterOptions.issues.map((issue) => (
                  <option key={issue} value={issue}>
                    {issue}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Solution Approach:</label>
              <select
                value={filters.idea}
                onChange={(e) => handleFilterChange("idea", e.target.value)}
              >
                <option value=""></option>
                {filterOptions.ideas.map((idea) => (
                  <option key={idea} value={idea}>
                    {idea}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Ecology:</label>
              <select
                value={filters.ecology}
                onChange={(e) => handleFilterChange("ecology", e.target.value)}
              >
                <option value=""></option>
                {filterOptions.ecology.map((eco) => (
                  <option key={eco} value={eco}>
                    {eco}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Governance:</label>
              <select
                value={filters.governance}
                onChange={(e) => handleFilterChange("governance", e.target.value)}
              >
                <option value=""></option>
                {filterOptions.governance.map((gov) => (
                  <option key={gov} value={gov}>
                    {gov}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Economic:</label>
              <select
                value={filters.economic}
                onChange={(e) => handleFilterChange("economic", e.target.value)}
              >
                <option value=""></option>
                {filterOptions.economic.map((econ) => (
                  <option key={econ} value={econ}>
                    {econ}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Socio-Cultural:</label>
              <select
                value={filters.socio_cultural}
                onChange={(e) =>
                  handleFilterChange("socio_cultural", e.target.value)
                }
              >
                <option value=""></option>
                {filterOptions.socio_cultural.map((socio) => (
                  <option key={socio} value={socio}>
                    {socio}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Upgrading:</label>
              <select
                value={filters.upgrading}
                onChange={(e) => handleFilterChange("upgrading", e.target.value)}
              >
                <option value=""></option>
                {filterOptions.upgrading.map((upgrade) => (
                  <option key={upgrade} value={upgrade}>
                    {upgrade}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
      
      {/* Results */}
      <div className="results-summary">
        <p>
          {filteredProjects.length} project
          {filteredProjects.length !== 1 ? "s" : ""} found
          {filters.latitude && filters.longitude && filters.radius_km && (
            <span className="location-context">
              within {filters.radius_km}km of{" "}
              {formatCoordinates(filters.latitude, filters.longitude)}
            </span>
          )}
        </p>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="no-results">
          <h3>No Projects Found</h3>
          <p>Try adjusting the filters or clearing them to see more results.</p>
          <button onClick={clearFilters} className="retry-button">
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {filteredProjects.map((project) => {
            const primaryFactors = getPrimaryFactors(project);

            return (
              <div
                key={project.id}
                className="project-card"
                onClick={() => showProjectDetails(project.id)}
              >
                <div className="project-header">
                  <div className="project-title">
                    {project.case || "Unnamed Project"}
                  </div>
                  <div className="project-coordinates">
                    {formatCoordinates(project.latitude, project.longitude)}
                  </div>
                </div>

                <div className="project-info">
                  <div className="info-section">
                    <h4>Primary Problem:</h4>
                    <p>{primaryFactors.issue}</p>
                    {project.issues && project.issues.length > 1 && (
                      <span className="additional-count">
                        +{project.issues.length - 1} more
                      </span>
                    )}
                  </div>

                  <div className="info-section">
                    <h4>Primary Solution:</h4>
                    <p>{primaryFactors.idea}</p>
                    {project.ideas && project.ideas.length > 1 && (
                      <span className="additional-count">
                        +{project.ideas.length - 1} more
                      </span>
                    )}
                  </div>

                  <div className="factor-overview">
                    <div className="factor-category">
                      <span className="factor-label">Ecology:</span>
                      <FactorTags
                        factors={project.ecology_factors}
                        maxShow={2}
                        className="ecology"
                      />
                    </div>

                    <div className="factor-category">
                      <span className="factor-label">Economic:</span>
                      <FactorTags
                        factors={project.economic_factors}
                        maxShow={2}
                        className="economic"
                      />
                    </div>

                    <div className="factor-category">
                      <span className="factor-label">Governance:</span>
                      <FactorTags
                        factors={project.governance_types}
                        maxShow={2}
                        className="governance"
                      />
                    </div>
                  </div>

                  <div className="project-meta">
                    <small>Created: {formatDate(project.created_at)}</small>
                    <small className="click-hint">Click for details</small>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedProject.case}</h2>
              <button
                className="close-button"
                onClick={() => setSelectedProject(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="project-overview">
                <div className="overview-item">
                  <strong>Location:</strong>{" "}
                  {formatCoordinates(
                    selectedProject.latitude,
                    selectedProject.longitude
                  )}
                </div>
                <div className="overview-item">
                  <strong>Created:</strong>{" "}
                  {formatDate(selectedProject.created_at)}
                </div>
              </div>

              <div className="detail-grid">
                <FactorSection
                  title="Issues & Problems"
                  factors={selectedProject.issues}
                  icon="⚠️"
                  colorClass="issues-section"
                />

                <FactorSection
                  title="Solution Approaches"
                  factors={selectedProject.ideas}
                  icon="💡"
                  colorClass="ideas-section"
                />

                <FactorSection
                  title="Ecological Factors"
                  factors={selectedProject.ecology_factors}
                  icon="🌱"
                  colorClass="ecology-section"
                />

                <FactorSection
                  title="Socio-Cultural Aspects"
                  factors={selectedProject.socio_cultural_aspects}
                  icon="👥"
                  colorClass="socio-section"
                />

                <FactorSection
                  title="Economic Factors"
                  factors={selectedProject.economic_factors}
                  icon="💰"
                  colorClass="economic-section"
                />

                <FactorSection
                  title="Upgrading Approaches"
                  factors={selectedProject.upgrading_approaches}
                  icon="🔧"
                  colorClass="upgrading-section"
                />

                <FactorSection
                  title="Governance Types"
                  factors={selectedProject.governance_types}
                  icon="🏛️"
                  colorClass="governance-section"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;