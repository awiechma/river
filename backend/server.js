const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test database connection and PostGIS availability
pool.connect(async (err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to PostgreSQL database');
    
    try {
      // Test if PostGIS is available
      const result = await client.query('SELECT PostGIS_Version();');
    } catch (error) {
      console.error('PostGIS not available:', error.message);
    }
    release();
  }
});

// Helper function to get factor ID by name
const getFactorId = async (tableName, factorName) => {
  if (!factorName) return null;
  
  const result = await pool.query(
    `SELECT id FROM ${tableName} WHERE name ILIKE $1`,
    [factorName]
  );
  
  return result.rows.length > 0 ? result.rows[0].id : null;
};

// Routes

// Get all river projects with optional filtering using arrays
app.get('/api/projects', async (req, res) => {
  try {
    const { 
      case_name,      // Filter by case name
      issue,          // Filter by issue name (checks if in array)
      idea,           // Filter by idea name  
      ecology,        // Filter by ecology factor name
      governance,     // Filter by governance type name
      economic,       // Filter by economic factor name
      socio_cultural, // Filter by socio-cultural aspect name
      upgrading,      // Filter by upgrading approach name
      latitude,       // For location-based filtering
      longitude,
      radius_km       // Search radius in kilometers
    } = req.query;

    // Start with the main table query and then get details from view
    let whereConditions = ['1=1'];
    const params = [];
    let paramCount = 0;

    // Text-based filtering on case name
    if (case_name) {
      paramCount++;
      whereConditions.push(`"case" ILIKE $${paramCount}`);
      params.push(`%${case_name}%`);
    }

    // Array-based filtering: check if factor ID exists in project's array
    if (issue) {
      const issueId = await getFactorId('issues', issue);
      if (issueId) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(issue_ids)`);
        params.push(issueId);
      }
    }

    if (idea) {
      const ideaId = await getFactorId('ideas', idea);
      if (ideaId) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(idea_ids)`);
        params.push(ideaId);
      }
    }

    if (ecology) {
      const ecologyId = await getFactorId('ecology_factors', ecology);
      if (ecologyId) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(ecology_factor_ids)`);
        params.push(ecologyId);
      }
    }

    if (governance) {
      const governanceId = await getFactorId('governance_types', governance);
      if (governanceId) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(governance_type_ids)`);
        params.push(governanceId);
      }
    }

    if (economic) {
      const economicId = await getFactorId('economic_factors', economic);
      if (economicId) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(economic_factor_ids)`);
        params.push(economicId);
      }
    }

    if (socio_cultural) {
      const socioId = await getFactorId('socio_cultural_aspects', socio_cultural);
      if (socioId) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(socio_cultural_ids)`);
        params.push(socioId);
      }
    }

    if (upgrading) {
      const upgradingId = await getFactorId('upgrading_approaches', upgrading);
      if (upgradingId) {
        paramCount++;
        whereConditions.push(`$${paramCount} = ANY(upgrading_ids)`);
        params.push(upgradingId);
      }
    }

    // Geographic filtering
    if (latitude && longitude && radius_km) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radiusMeters = parseFloat(radius_km) * 1000;
      
      paramCount++;
      whereConditions.push(`ST_DWithin(location, ST_MakePoint($${paramCount + 1}, $${paramCount})::GEOGRAPHY, $${paramCount + 2})`);
      params.push(lat, lng, radiusMeters);
      paramCount += 2;
    }

    // Build the main query using the filtered IDs
    const mainQuery = `
      SELECT id FROM river_projects 
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY created_at DESC
    `;

    const filteredIds = await pool.query(mainQuery, params);
    
    if (filteredIds.rows.length === 0) {
      return res.json([]);
    }

    // Get full details for filtered projects using the view
    const idList = filteredIds.rows.map(row => row.id);
    const detailsQuery = `
      SELECT 
        id,
        "case",
        longitude,
        latitude,
        location_geojson,
        created_at,
        issues,
        ideas,
        ecology_factors,
        socio_cultural_aspects,
        economic_factors,
        upgrading_approaches,
        governance_types
      FROM project_array_details 
      WHERE id = ANY($1)
      ORDER BY created_at DESC
    `;

    const result = await pool.query(detailsQuery, [idList]);
    
    // Process results - JSON fields are already parsed by PostgreSQL
    const processedRows = result.rows.map(row => ({
      ...row,
      location_geojson: row.location_geojson ? JSON.parse(row.location_geojson) : null,
      // Convert null JSON arrays to empty arrays
      issues: row.issues || [],
      ideas: row.ideas || [],
      ecology_factors: row.ecology_factors || [],
      socio_cultural_aspects: row.socio_cultural_aspects || [],
      economic_factors: row.economic_factors || [],
      upgrading_approaches: row.upgrading_approaches || [],
      governance_types: row.governance_types || []
    }));
    
    res.json(processedRows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get unique filter values for dropdown menus from factor tables
app.get('/api/filter-options', async (req, res) => {
  try {
    // Get all available factors from the factor tables
    const [
      casesResult,
      issuesResult,
      ideasResult,
      ecologyResult,
      governanceResult,
      economicResult,
      socioCulturalResult,
      upgradingResult
    ] = await Promise.all([
      pool.query('SELECT DISTINCT "case" FROM river_projects WHERE "case" IS NOT NULL ORDER BY "case"'),
      pool.query('SELECT name FROM issues ORDER BY name'),
      pool.query('SELECT name FROM ideas ORDER BY name'),
      pool.query('SELECT name FROM ecology_factors ORDER BY name'),
      pool.query('SELECT name FROM governance_types ORDER BY name'),
      pool.query('SELECT name FROM economic_factors ORDER BY name'),
      pool.query('SELECT name FROM socio_cultural_aspects ORDER BY name'),
      pool.query('SELECT name FROM upgrading_approaches ORDER BY name')
    ]);

    res.json({
      cases: casesResult.rows.map(row => row.case),
      issues: issuesResult.rows.map(row => row.name),
      ideas: ideasResult.rows.map(row => row.name),
      ecology: ecologyResult.rows.map(row => row.name),
      governance: governanceResult.rows.map(row => row.name),
      economic: economicResult.rows.map(row => row.name),
      socio_cultural: socioCulturalResult.rows.map(row => row.name),
      upgrading: upgradingResult.rows.map(row => row.name)
    });
  } catch (err) {
    console.error('Error fetching filter options:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get project by ID with full information
app.get('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get complete project information from the array view
    const result = await pool.query(`
      SELECT 
        id,
        "case",
        longitude,
        latitude,
        location_geojson,
        created_at,
        issues,
        ideas,
        ecology_factors,
        socio_cultural_aspects,
        economic_factors,
        upgrading_approaches,
        governance_types
      FROM project_array_details 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const project = result.rows[0];
    
    // Process the result
    const processedProject = {
      ...project,
      location_geojson: project.location_geojson ? JSON.parse(project.location_geojson) : null,
      // Ensure arrays are not null
      issues: project.issues || [],
      ideas: project.ideas || [],
      ecology_factors: project.ecology_factors || [],
      socio_cultural_aspects: project.socio_cultural_aspects || [],
      economic_factors: project.economic_factors || [],
      upgrading_approaches: project.upgrading_approaches || [],
      governance_types: project.governance_types || []
    };
    
    res.json(processedProject);
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Find projects near a specific location
app.get('/api/projects/near/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { radius = 10 } = req.query; // Default 10km radius
    
    const result = await pool.query(`
      SELECT 
        pad.id,
        pad."case",
        pad.longitude,
        pad.latitude,
        ST_Distance(rp.location, ST_MakePoint($2, $1)::GEOGRAPHY) as distance_meters,
        pad.issues,
        pad.ideas
      FROM project_array_details pad
      JOIN river_projects rp ON pad.id = rp.id
      WHERE ST_DWithin(rp.location, ST_MakePoint($2, $1)::GEOGRAPHY, $3)
      ORDER BY distance_meters
    `, [parseFloat(lat), parseFloat(lng), parseFloat(radius) * 1000]);
    
    // Process results
    const processedRows = result.rows.map(row => ({
      ...row,
      issues: row.issues || [],
      ideas: row.ideas || []
    }));
    
    res.json(processedRows);
  } catch (err) {
    console.error('Error finding nearby projects:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Create a new project with multiple factors
app.post('/api/projects', async (req, res) => {
  try {
    const {
      case_name,
      latitude,
      longitude,
      // Arrays of factor names
      issue_names = [],
      idea_names = [],
      ecology_names = [],
      socio_cultural_names = [],
      economic_names = [],
      upgrading_names = [],
      governance_names = []
    } = req.body;

    // Validate required fields
    if (!case_name || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required fields: case_name, latitude, longitude' 
      });
    }

    // Convert factor names to IDs
    const getFactorIds = async (tableName, factorNames) => {
      if (!Array.isArray(factorNames) || factorNames.length === 0) return [];
      
      const result = await pool.query(
        `SELECT id FROM ${tableName} WHERE name = ANY($1)`,
        [factorNames]
      );
      
      return result.rows.map(row => row.id);
    };

    // Get all factor IDs
    const [
      issueIds,
      ideaIds,
      ecologyIds,
      socioCulturalIds,
      economicIds,
      upgradingIds,
      governanceIds
    ] = await Promise.all([
      getFactorIds('issues', issue_names),
      getFactorIds('ideas', idea_names),
      getFactorIds('ecology_factors', ecology_names),
      getFactorIds('socio_cultural_aspects', socio_cultural_names),
      getFactorIds('economic_factors', economic_names),
      getFactorIds('upgrading_approaches', upgrading_names),
      getFactorIds('governance_types', governance_names)
    ]);

    // Insert the project with arrays
    const result = await pool.query(`
      INSERT INTO river_projects (
        "case", location, issue_ids, idea_ids, ecology_factor_ids, 
        socio_cultural_ids, economic_factor_ids, upgrading_ids, governance_type_ids
      ) VALUES ($1, ST_MakePoint($2, $3)::GEOGRAPHY, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at
    `, [
      case_name, 
      parseFloat(longitude), 
      parseFloat(latitude),
      issueIds,
      ideaIds,
      ecologyIds,
      socioCulturalIds,
      economicIds,
      upgradingIds,
      governanceIds
    ]);

    res.status(201).json({
      message: 'Project created successfully',
      id: result.rows[0].id,
      created_at: result.rows[0].created_at
    });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get statistics about factor usage with arrays
app.get('/api/statistics', async (req, res) => {
  try {
    const [
      issueStats,
      ideaStats,
      ecologyStats,
      governanceStats,
      economicStats,
      projectCount
    ] = await Promise.all([
      pool.query(`
        SELECT i.name, COUNT(p.id) as project_count, i.description
        FROM issues i
        LEFT JOIN river_projects p ON i.id = ANY(p.issue_ids)
        GROUP BY i.id, i.name, i.description
        ORDER BY project_count DESC, i.name
      `),
      pool.query(`
        SELECT i.name, COUNT(p.id) as project_count, i.description
        FROM ideas i
        LEFT JOIN river_projects p ON i.id = ANY(p.idea_ids)
        GROUP BY i.id, i.name, i.description
        ORDER BY project_count DESC, i.name
      `),
      pool.query(`
        SELECT ef.name, COUNT(p.id) as project_count, ef.description
        FROM ecology_factors ef
        LEFT JOIN river_projects p ON ef.id = ANY(p.ecology_factor_ids)
        GROUP BY ef.id, ef.name, ef.description
        ORDER BY project_count DESC, ef.name
      `),
      pool.query(`
        SELECT gt.name, COUNT(p.id) as project_count, gt.description
        FROM governance_types gt
        LEFT JOIN river_projects p ON gt.id = ANY(p.governance_type_ids)
        GROUP BY gt.id, gt.name, gt.description
        ORDER BY project_count DESC, gt.name
      `),
      pool.query(`
        SELECT ef.name, COUNT(p.id) as project_count, ef.description
        FROM economic_factors ef
        LEFT JOIN river_projects p ON ef.id = ANY(p.economic_factor_ids)
        GROUP BY ef.id, ef.name, ef.description
        ORDER BY project_count DESC, ef.name
      `),
      pool.query('SELECT COUNT(*) as count FROM river_projects')
    ]);

    res.json({
      issues: issueStats.rows,
      ideas: ideaStats.rows,
      ecology: ecologyStats.rows,
      governance: governanceStats.rows,
      economic: economicStats.rows,
      total_projects: projectCount.rows[0].count
    });
  } catch (err) {
    console.error('Error fetching statistics:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get all factors with their descriptions and usage counts
app.get('/api/factors', async (req, res) => {
  try {
    const [
      issues,
      ideas,
      ecology,
      socioCultural,
      economic,
      upgrading,
      governance
    ] = await Promise.all([
      pool.query(`
        SELECT i.*, COUNT(p.id) as usage_count 
        FROM issues i 
        LEFT JOIN river_projects p ON i.id = ANY(p.issue_ids)
        GROUP BY i.id ORDER BY usage_count DESC, i.name
      `),
      pool.query(`
        SELECT i.*, COUNT(p.id) as usage_count 
        FROM ideas i 
        LEFT JOIN river_projects p ON i.id = ANY(p.idea_ids)
        GROUP BY i.id ORDER BY usage_count DESC, i.name
      `),
      pool.query(`
        SELECT ef.*, COUNT(p.id) as usage_count 
        FROM ecology_factors ef 
        LEFT JOIN river_projects p ON ef.id = ANY(p.ecology_factor_ids)
        GROUP BY ef.id ORDER BY usage_count DESC, ef.name
      `),
      pool.query(`
        SELECT sca.*, COUNT(p.id) as usage_count 
        FROM socio_cultural_aspects sca 
        LEFT JOIN river_projects p ON sca.id = ANY(p.socio_cultural_ids)
        GROUP BY sca.id ORDER BY usage_count DESC, sca.name
      `),
      pool.query(`
        SELECT ec.*, COUNT(p.id) as usage_count 
        FROM economic_factors ec 
        LEFT JOIN river_projects p ON ec.id = ANY(p.economic_factor_ids)
        GROUP BY ec.id ORDER BY usage_count DESC, ec.name
      `),
      pool.query(`
        SELECT ua.*, COUNT(p.id) as usage_count 
        FROM upgrading_approaches ua 
        LEFT JOIN river_projects p ON ua.id = ANY(p.upgrading_ids)
        GROUP BY ua.id ORDER BY usage_count DESC, ua.name
      `),
      pool.query(`
        SELECT gt.*, COUNT(p.id) as usage_count 
        FROM governance_types gt 
        LEFT JOIN river_projects p ON gt.id = ANY(p.governance_type_ids)
        GROUP BY gt.id ORDER BY usage_count DESC, gt.name
      `)
    ]);

    res.json({
      issues: issues.rows,
      ideas: ideas.rows,
      ecology: ecology.rows,
      socio_cultural: socioCultural.rows,
      economic: economic.rows,
      upgrading: upgrading.rows,
      governance: governance.rows
    });
  } catch (err) {
    console.error('Error fetching factors:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get footer statistics (total projects, countries, categories)
app.get('/api/footer-stats', async (req, res) => {
  try {
    const [
      projectCountResult,
      uniqueCountriesResult
    ] = await Promise.all([
      // Total project count
      pool.query('SELECT COUNT(*) as count FROM river_projects'),
      
      // Unique countries count (based on PostGIS location field)
      pool.query(`
        SELECT COUNT(DISTINCT country) as count FROM (
          SELECT 
            CASE 
              -- Europe
              WHEN ST_X(location::geometry) BETWEEN -10 AND 40 AND ST_Y(location::geometry) BETWEEN 35 AND 70 THEN
                CASE
                  WHEN ST_X(location::geometry) BETWEEN 5.9 AND 15.0 AND ST_Y(location::geometry) BETWEEN 45.8 AND 55.1 THEN 'Germany'
                  WHEN ST_X(location::geometry) BETWEEN -5.1 AND 9.6 AND ST_Y(location::geometry) BETWEEN 41.3 AND 51.1 THEN 'France'
                  WHEN ST_X(location::geometry) BETWEEN 6.7 AND 18.9 AND ST_Y(location::geometry) BETWEEN 35.5 AND 47.1 THEN 'Italy'
                  WHEN ST_X(location::geometry) BETWEEN -9.5 AND -6.2 AND ST_Y(location::geometry) BETWEEN 36.0 AND 42.2 THEN 'Portugal'
                  WHEN ST_X(location::geometry) BETWEEN -18.2 AND -13.4 AND ST_Y(location::geometry) BETWEEN 27.6 AND 29.5 THEN 'Spain'
                  WHEN ST_X(location::geometry) BETWEEN 9.5 AND 17.2 AND ST_Y(location::geometry) BETWEEN 46.4 AND 49.0 THEN 'Austria'
                  WHEN ST_X(location::geometry) BETWEEN 2.5 AND 7.2 AND ST_Y(location::geometry) BETWEEN 49.5 AND 53.6 THEN 'Netherlands'
                  WHEN ST_X(location::geometry) BETWEEN 12.0 AND 24.2 AND ST_Y(location::geometry) BETWEEN 49.0 AND 54.9 THEN 'Poland'
                  WHEN ST_X(location::geometry) BETWEEN -8.2 AND 1.8 AND ST_Y(location::geometry) BETWEEN 49.9 AND 60.9 THEN 'United Kingdom'
                  ELSE 'Other Europe'
                END
              
              -- North America
              WHEN ST_X(location::geometry) BETWEEN -180 AND -50 AND ST_Y(location::geometry) BETWEEN 25 AND 70 THEN
                CASE
                  WHEN ST_X(location::geometry) BETWEEN -125 AND -66 AND ST_Y(location::geometry) BETWEEN 49 AND 70 THEN 'Canada'
                  WHEN ST_X(location::geometry) BETWEEN -125 AND -66 AND ST_Y(location::geometry) BETWEEN 25 AND 49 THEN 'United States'
                  ELSE 'Other North America'
                END
              
              -- Asia
              WHEN ST_X(location::geometry) BETWEEN 25 AND 180 AND ST_Y(location::geometry) BETWEEN 5 AND 80 THEN
                CASE
                  WHEN ST_X(location::geometry) BETWEEN 73 AND 135 AND ST_Y(location::geometry) BETWEEN 18 AND 54 THEN 'China'
                  WHEN ST_X(location::geometry) BETWEEN 129 AND 146 AND ST_Y(location::geometry) BETWEEN 31 AND 46 THEN 'Japan'
                  WHEN ST_X(location::geometry) BETWEEN 68 AND 97 AND ST_Y(location::geometry) BETWEEN 6 AND 37 THEN 'India'
                  ELSE 'Other Asia'
                END
              
              -- South America
              WHEN ST_X(location::geometry) BETWEEN -82 AND -35 AND ST_Y(location::geometry) BETWEEN -56 AND 13 THEN
                CASE
                  WHEN ST_X(location::geometry) BETWEEN -74 AND -35 AND ST_Y(location::geometry) BETWEEN -35 AND 5 THEN 'Brazil'
                  WHEN ST_X(location::geometry) BETWEEN -81 AND -67 AND ST_Y(location::geometry) BETWEEN -18 AND 13 THEN 'Peru'
                  ELSE 'Other South America'
                END
              
              -- Australia/Oceania
              WHEN ST_X(location::geometry) BETWEEN 110 AND 180 AND ST_Y(location::geometry) BETWEEN -50 AND -10 THEN 'Australia'
              
              -- Africa
              WHEN ST_X(location::geometry) BETWEEN -20 AND 55 AND ST_Y(location::geometry) BETWEEN -35 AND 38 THEN 'Africa'
              
              ELSE 'Unknown'
            END as country
          FROM river_projects
          WHERE location IS NOT NULL
        ) country_mapping
        WHERE country != 'Unknown'
      `)
    ]);

    const totalProjects = parseInt(projectCountResult.rows[0].count);
    const totalCountries = parseInt(uniqueCountriesResult.rows[0].count);

    res.json({
      totalProjects,
      totalCountries
    });

  } catch (err) {
    console.error('Error fetching footer stats:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// In deiner server.js oder routes.js
app.post('/api/init-db', async (req, res) => {
  try {
    // PostgreSQL Client verwenden
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    
    // init.sql Inhalt hier einfügen
    const initSQL = `
      -- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Factor tables with descriptions (Master Data)
CREATE TABLE IF NOT EXISTS issues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS ideas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS ecology_factors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS socio_cultural_aspects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS economic_factors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS upgrading_approaches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS governance_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT
);

-- Main projects table with arrays of factor IDs
CREATE TABLE IF NOT EXISTS river_projects (
    id SERIAL PRIMARY KEY,
    "case" VARCHAR(255) NOT NULL,
    location GEOGRAPHY(Point, 4326) NOT NULL,
    
    -- Arrays of factor IDs for multiple factors per project
    issue_ids INTEGER[] DEFAULT '{}',
    idea_ids INTEGER[] DEFAULT '{}',
    ecology_factor_ids INTEGER[] DEFAULT '{}',
    socio_cultural_ids INTEGER[] DEFAULT '{}',
    economic_factor_ids INTEGER[] DEFAULT '{}',
    upgrading_ids INTEGER[] DEFAULT '{}',
    governance_type_ids INTEGER[] DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_river_projects_location 
ON river_projects USING GIST (location);

-- Create GIN indexes for array columns (important for array queries!)
CREATE INDEX IF NOT EXISTS idx_projects_issues_gin ON river_projects USING GIN (issue_ids);
CREATE INDEX IF NOT EXISTS idx_projects_ideas_gin ON river_projects USING GIN (idea_ids);
CREATE INDEX IF NOT EXISTS idx_projects_ecology_gin ON river_projects USING GIN (ecology_factor_ids);
CREATE INDEX IF NOT EXISTS idx_projects_socio_gin ON river_projects USING GIN (socio_cultural_ids);
CREATE INDEX IF NOT EXISTS idx_projects_economic_gin ON river_projects USING GIN (economic_factor_ids);
CREATE INDEX IF NOT EXISTS idx_projects_upgrading_gin ON river_projects USING GIN (upgrading_ids);
CREATE INDEX IF NOT EXISTS idx_projects_governance_gin ON river_projects USING GIN (governance_type_ids);

-- Insert factor data
INSERT INTO issues (name, description) VALUES
('Channel straightening', 'Artificial modification of natural river channels, reducing meandering and natural flow patterns'),
('Industrial pollution', 'Contamination from manufacturing processes, chemicals, and heavy metals affecting water quality'),
('Habitat fragmentation', 'Disconnected ecosystems due to infrastructure development, reducing biodiversity'),
('Flood risk', 'Increased flooding probability due to reduced natural retention capacity and climate change'),
('Agricultural runoff', 'Nutrient pollution from farming activities causing eutrophication and algal blooms'),
('Dam barriers', 'Physical obstructions preventing fish migration and natural sediment transport'),
('Urban development pressure', 'Encroachment of built environment reducing natural floodplains and green corridors'),
('Invasive species', 'Non-native plants and animals disrupting natural ecosystem balance'),
('Water scarcity', 'Reduced flow due to over-extraction, drought, or climate change impacts'),
('Sediment trapping', 'Accumulation of sediments behind structures affecting downstream morphology'),
('Saltwater intrusion', 'Penetration of seawater into freshwater systems due to sea level rise'),
('Thermal pollution', 'Temperature changes from industrial discharge affecting aquatic life');

INSERT INTO ideas (name, description) VALUES
('Meander reconstruction', 'Restoring natural river curves and flow patterns to improve habitat diversity'),
('Fish pass construction', 'Building structures to enable fish migration around barriers while maintaining navigation'),
('Riparian forest restoration', 'Replanting native trees and vegetation along riverbanks for erosion control and habitat'),
('Floodplain reconnection', 'Removing barriers to allow periodic flooding of natural retention areas'),
('Living shorelines', 'Using natural materials like oyster reefs and vegetation instead of hard infrastructure'),
('Dam removal', 'Selective removal of obsolete dams to restore free-flowing river conditions'),
('Constructed wetlands', 'Creating artificial wetlands for water treatment and wildlife habitat'),
('Green infrastructure', 'Implementing nature-based solutions for stormwater management in urban areas'),
('Invasive species control', 'Systematic removal and management of non-native species'),
('Water level management', 'Optimizing flow regimes to balance ecological and human needs'),
('Sediment bypass systems', 'Technical solutions to maintain sediment transport around obstacles'),
('Bioremediation', 'Using plants and microorganisms to remove pollutants from water and soil');

INSERT INTO ecology_factors (name, description) VALUES
('Biodiversity enhancement', 'Increasing species diversity and abundance through habitat improvement'),
('Fish migration restoration', 'Enabling natural movement patterns of anadromous and resident fish species'),
('Wetland ecosystem recovery', 'Restoring natural wetland functions including filtration and habitat provision'),
('Native species reintroduction', 'Bringing back locally extinct species to restore ecological balance'),
('Carbon sequestration', 'Capturing atmospheric carbon dioxide in vegetation and soils'),
('Water quality improvement', 'Reducing pollutants and enhancing natural filtration processes'),
('Pollinator habitat creation', 'Establishing flowering plants to support bee and butterfly populations'),
('Riparian corridor connectivity', 'Creating continuous habitat links along river systems'),
('Soil erosion prevention', 'Stabilizing banks and reducing sediment loss through vegetation'),
('Aquatic habitat diversification', 'Creating varied underwater environments for different species needs');

INSERT INTO socio_cultural_aspects (name, description) VALUES
('Community engagement', 'Involving local residents in planning, implementation, and monitoring activities'),
('Environmental education', 'Teaching ecological concepts and conservation practices to diverse audiences'),
('Cultural heritage preservation', 'Protecting historical sites and traditional practices related to river systems'),
('Recreational facility development', 'Creating parks, trails, and access points for public enjoyment'),
('Indigenous knowledge integration', 'Incorporating traditional ecological wisdom into modern restoration practices'),
('Public health benefits', 'Improving air and water quality to enhance community wellbeing'),
('Social equity initiatives', 'Ensuring disadvantaged communities benefit from restoration projects'),
('Volunteer program coordination', 'Organizing citizen participation in hands-on restoration activities'),
('Cultural landscape restoration', 'Maintaining traditional relationships between communities and rivers'),
('Intergenerational learning', 'Connecting elders with youth to transfer environmental knowledge');

INSERT INTO economic_factors (name, description) VALUES
('Eco-tourism development', 'Creating sustainable tourism opportunities based on natural attractions'),
('Flood damage prevention', 'Reducing economic losses from flooding through natural flood management'),
('Property value enhancement', 'Increasing real estate values through environmental quality improvements'),
('Sustainable fisheries', 'Supporting commercial and recreational fishing through habitat restoration'),
('Green job creation', 'Generating employment in environmental restoration and management sectors'),
('Agricultural productivity', 'Improving crop yields through better water quality and soil health'),
('Water treatment cost savings', 'Reducing municipal treatment expenses through natural filtration systems'),
('Carbon credit generation', 'Creating revenue streams through verified carbon sequestration projects'),
('Renewable energy integration', 'Incorporating sustainable energy systems into restoration infrastructure'),
('Research and innovation hub', 'Attracting scientific institutions and technology development');

INSERT INTO upgrading_approaches (name, description) VALUES
('Smart monitoring systems', 'Installing sensor networks for real-time environmental data collection'),
('Climate adaptation infrastructure', 'Building resilience to changing precipitation and temperature patterns'),
('Precision restoration techniques', 'Using GPS, drones, and data analysis for targeted interventions'),
('Modular design implementation', 'Creating flexible systems that can be adjusted as conditions change'),
('Renewable energy integration', 'Powering restoration infrastructure with solar, wind, or hydropower'),
('Digital twin modeling', 'Creating virtual replicas for simulation and optimization of restoration outcomes'),
('Automated maintenance systems', 'Implementing self-regulating infrastructure requiring minimal human intervention'),
('Advanced materials usage', 'Utilizing innovative, sustainable materials for long-term durability'),
('Integrated management platforms', 'Coordinating multiple restoration activities through centralized systems'),
('Adaptive management protocols', 'Establishing frameworks for continuous learning and adjustment');

INSERT INTO governance_types (name, description) VALUES
('International cooperation', 'Cross-border collaboration through treaties, agreements, and joint management'),
('EU funding programs', 'European Union financial support through LIFE+, Horizon, and cohesion funds'),
('Federal-state coordination', 'Collaboration between national and regional government levels'),
('Municipal planning integration', 'Incorporating restoration into local zoning and development policies'),
('Public-private partnerships', 'Combining government oversight with private sector efficiency and innovation'),
('NGO-led initiatives', 'Non-governmental organizations driving conservation through advocacy and action'),
('Community-based management', 'Local residents taking leadership roles in restoration planning and implementation'),
('Indigenous governance', 'Traditional authorities managing restoration according to cultural protocols'),
('Scientific advisory boards', 'Expert panels providing technical guidance for restoration decisions'),
('Adaptive governance frameworks', 'Flexible management systems that evolve based on outcomes and learning'),
('Transboundary water commissions', 'International bodies coordinating water resource management across borders'),
('Watershed councils', 'Stakeholder groups managing restoration at the catchment scale');

-- Insert sample projects with multiple factors using arrays
INSERT INTO river_projects ("case", location, issue_ids, idea_ids, ecology_factor_ids, socio_cultural_ids, economic_factor_ids, upgrading_ids, governance_type_ids) VALUES
(
    'Rhine Restoration Basel-Kembs', 
    ST_SetSRID(ST_MakePoint(7.588576, 47.559601), 4326)::GEOGRAPHY,
    ARRAY[1, 2, 3],        -- Channel straightening, Industrial pollution, Habitat fragmentation
    ARRAY[1, 3, 4],        -- Meander reconstruction, Riparian forest restoration, Floodplain reconnection
    ARRAY[1, 2, 5, 6],     -- Biodiversity enhancement, Fish migration restoration, Carbon sequestration, Water quality improvement
    ARRAY[1, 2, 4],        -- Community engagement, Environmental education, Recreational facility development
    ARRAY[1, 2, 3, 5],     -- Eco-tourism development, Flood damage prevention, Property value enhancement, Green job creation
    ARRAY[1, 2],           -- Smart monitoring systems, Climate adaptation infrastructure
    ARRAY[1, 2, 5]         -- International cooperation, EU funding programs, Public-private partnerships
),
(
    'Danube Floodplain Vienna', 
    ST_SetSRID(ST_MakePoint(16.373819, 48.208174), 4326)::GEOGRAPHY,
    ARRAY[4, 7],           -- Flood risk, Urban development pressure
    ARRAY[4, 8],           -- Floodplain reconnection, Green infrastructure
    ARRAY[3, 1, 9],        -- Wetland ecosystem recovery, Biodiversity enhancement, Soil erosion prevention
    ARRAY[4, 6],           -- Recreational facility development, Public health benefits
    ARRAY[2, 3, 5],        -- Flood damage prevention, Property value enhancement, Green job creation
    ARRAY[2, 9],           -- Climate adaptation infrastructure, Integrated management platforms
    ARRAY[4, 2]            -- Municipal planning integration, EU funding programs
),
(
    'Thames Living Shorelines London', 
    ST_SetSRID(ST_MakePoint(-0.118092, 51.509865), 4326)::GEOGRAPHY,
    ARRAY[3, 7],           -- Habitat fragmentation, Urban development pressure
    ARRAY[5, 8],           -- Living shorelines, Green infrastructure
    ARRAY[10, 5, 7],       -- Aquatic habitat diversification, Carbon sequestration, Pollinator habitat creation
    ARRAY[6, 7],           -- Public health benefits, Social equity initiatives
    ARRAY[3, 5, 8],        -- Property value enhancement, Green job creation, Carbon credit generation
    ARRAY[8, 5],           -- Advanced materials usage, Renewable energy integration
    ARRAY[4, 6]            -- Municipal planning integration, NGO-led initiatives
),
(
    'Elbe Dam Removal Geesthacht', 
    ST_SetSRID(ST_MakePoint(10.376669, 53.431946), 4326)::GEOGRAPHY,
    ARRAY[6, 10],          -- Dam barriers, Sediment trapping
    ARRAY[6, 2],           -- Dam removal, Fish pass construction
    ARRAY[2, 4, 6],        -- Fish migration restoration, Native species reintroduction, Water quality improvement
    ARRAY[3, 2],           -- Cultural heritage preservation, Environmental education
    ARRAY[4, 9],           -- Sustainable fisheries, Research and innovation hub
    ARRAY[3, 10],          -- Precision restoration techniques, Adaptive management protocols
    ARRAY[3, 9]            -- Federal-state coordination, Scientific advisory boards
),
(
    'Po Meander Restoration Ferrara', 
    ST_SetSRID(ST_MakePoint(11.619787, 44.838124), 4326)::GEOGRAPHY,
    ARRAY[5, 1],           -- Agricultural runoff, Channel straightening
    ARRAY[1, 7],           -- Meander reconstruction, Constructed wetlands
    ARRAY[6, 8, 9],        -- Water quality improvement, Riparian corridor connectivity, Soil erosion prevention
    ARRAY[2, 1],           -- Environmental education, Community engagement
    ARRAY[6, 8],           -- Agricultural productivity, Carbon credit generation
    ARRAY[9, 10],          -- Integrated management platforms, Adaptive management protocols
    ARRAY[2, 12]           -- EU funding programs, Watershed councils
),
(
    'Seine Urban River Park Paris', 
    ST_SetSRID(ST_MakePoint(2.294481, 48.858370), 4326)::GEOGRAPHY,
    ARRAY[7, 12],          -- Urban development pressure, Thermal pollution
    ARRAY[8, 7],           -- Green infrastructure, Constructed wetlands
    ARRAY[7, 5, 9],        -- Pollinator habitat creation, Carbon sequestration, Soil erosion prevention
    ARRAY[7, 1, 4],        -- Social equity initiatives, Community engagement, Recreational facility development
    ARRAY[5, 3],           -- Green job creation, Property value enhancement
    ARRAY[5, 9],           -- Renewable energy integration, Integrated management platforms
    ARRAY[4]               -- Municipal planning integration
),
(
    'Oder Pollution Recovery Wrocław', 
    ST_SetSRID(ST_MakePoint(17.038538, 51.107883), 4326)::GEOGRAPHY,
    ARRAY[2, 5],           -- Industrial pollution, Agricultural runoff
    ARRAY[12, 7],          -- Bioremediation, Constructed wetlands
    ARRAY[6, 4],           -- Water quality improvement, Native species reintroduction
    ARRAY[6, 2],           -- Public health benefits, Environmental education
    ARRAY[9, 7],           -- Research and innovation hub, Water treatment cost savings
    ARRAY[1, 10],          -- Smart monitoring systems, Adaptive management protocols
    ARRAY[11, 2]           -- Transboundary water commissions, EU funding programs
),
(
    'Mekong Delta Climate Adaptation', 
    ST_SetSRID(ST_MakePoint(105.768311, 10.026309), 4326)::GEOGRAPHY,
    ARRAY[11, 4],          -- Saltwater intrusion, Flood risk
    ARRAY[5, 7],           -- Living shorelines, Constructed wetlands
    ARRAY[5, 3, 6],        -- Carbon sequestration, Wetland ecosystem recovery, Water quality improvement
    ARRAY[5, 8],           -- Indigenous knowledge integration, Volunteer program coordination
    ARRAY[8, 6],           -- Carbon credit generation, Agricultural productivity
    ARRAY[2, 10],          -- Climate adaptation infrastructure, Adaptive management protocols
    ARRAY[1, 5]            -- International cooperation, Public-private partnerships
),
(
    'Colorado River Habitat Restoration', 
    ST_SetSRID(ST_MakePoint(-114.572890, 35.160312), 4326)::GEOGRAPHY,
    ARRAY[8, 9],           -- Invasive species, Water scarcity
    ARRAY[9, 10],          -- Invasive species control, Water level management
    ARRAY[4, 1, 8],        -- Native species reintroduction, Biodiversity enhancement, Riparian corridor connectivity
    ARRAY[5, 10],          -- Indigenous knowledge integration, Intergenerational learning
    ARRAY[4, 9],           -- Sustainable fisheries, Research and innovation hub
    ARRAY[10, 3],          -- Adaptive management protocols, Precision restoration techniques
    ARRAY[8, 1]            -- Indigenous governance, International cooperation
),
(
    'Murray River Salinity Management', 
    ST_SetSRID(ST_MakePoint(140.360107, -34.394057), 4326)::GEOGRAPHY,
    ARRAY[9, 5],           -- Water scarcity, Agricultural runoff
    ARRAY[10, 7],          -- Water level management, Constructed wetlands
    ARRAY[6, 1, 8],        -- Water quality improvement, Biodiversity enhancement, Riparian corridor connectivity
    ARRAY[1, 2],           -- Community engagement, Environmental education
    ARRAY[6, 4],           -- Agricultural productivity, Sustainable fisheries
    ARRAY[1, 10],          -- Smart monitoring systems, Adaptive management protocols
    ARRAY[12, 3]           -- Watershed councils, Federal-state coordination
);

-- Create comprehensive view for array-based projects
CREATE OR REPLACE VIEW project_array_details AS
SELECT 
    p.id,
    p."case",
    ST_X(p.location::geometry) as longitude,
    ST_Y(p.location::geometry) as latitude,
    ST_AsGeoJSON(p.location) as location_geojson,
    p.created_at,
    
    -- Convert arrays to JSON with names and descriptions
    (SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'description', i.description))
     FROM unnest(p.issue_ids) as issue_id
     JOIN issues i ON i.id = issue_id) as issues,
    
    (SELECT json_agg(json_build_object('id', i.id, 'name', i.name, 'description', i.description))
     FROM unnest(p.idea_ids) as idea_id
     JOIN ideas i ON i.id = idea_id) as ideas,
    
    (SELECT json_agg(json_build_object('id', ef.id, 'name', ef.name, 'description', ef.description))
     FROM unnest(p.ecology_factor_ids) as ecology_id
     JOIN ecology_factors ef ON ef.id = ecology_id) as ecology_factors,
    
    (SELECT json_agg(json_build_object('id', sca.id, 'name', sca.name, 'description', sca.description))
     FROM unnest(p.socio_cultural_ids) as socio_id
     JOIN socio_cultural_aspects sca ON sca.id = socio_id) as socio_cultural_aspects,
    
    (SELECT json_agg(json_build_object('id', ec.id, 'name', ec.name, 'description', ec.description))
     FROM unnest(p.economic_factor_ids) as economic_id
     JOIN economic_factors ec ON ec.id = economic_id) as economic_factors,
    
    (SELECT json_agg(json_build_object('id', ua.id, 'name', ua.name, 'description', ua.description))
     FROM unnest(p.upgrading_ids) as upgrading_id
     JOIN upgrading_approaches ua ON ua.id = upgrading_id) as upgrading_approaches,
    
    (SELECT json_agg(json_build_object('id', gt.id, 'name', gt.name, 'description', gt.description))
     FROM unnest(p.governance_type_ids) as governance_id
     JOIN governance_types gt ON gt.id = governance_id) as governance_types

FROM river_projects p;
    `;
    
    await client.query(initSQL);
    await client.end();
    
    res.json({ message: 'Database initialized successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});