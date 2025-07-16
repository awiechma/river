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

// Vereinfachte init-db Route - nur PostGIS und Tabellen
app.post('/api/init-db-simple', async (req, res) => {
  try {
    const { Client } = require('pg');
    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    console.log('Connected to database');
    
    // Schritt 1: PostGIS Extension
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('PostGIS extension created');
    
    // Schritt 2: Factor tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS issues (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT
      );
    `);
    console.log('Issues table created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS ideas (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT
      );
    `);
    console.log('Ideas table created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS ecology_factors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT
      );
    `);
    console.log('Ecology factors table created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS socio_cultural_aspects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT
      );
    `);
    console.log('Socio cultural aspects table created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS economic_factors (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT
      );
    `);
    console.log('Economic factors table created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS upgrading_approaches (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT
      );
    `);
    console.log('Upgrading approaches table created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS governance_types (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT
      );
    `);
    console.log('Governance types table created');
    
    // Schritt 3: Main projects table
    await client.query(`
      CREATE TABLE IF NOT EXISTS river_projects (
          id SERIAL PRIMARY KEY,
          "case" VARCHAR(255) NOT NULL,
          location GEOGRAPHY(Point, 4326) NOT NULL,
          issue_ids INTEGER[] DEFAULT '{}',
          idea_ids INTEGER[] DEFAULT '{}',
          ecology_factor_ids INTEGER[] DEFAULT '{}',
          socio_cultural_ids INTEGER[] DEFAULT '{}',
          economic_factor_ids INTEGER[] DEFAULT '{}',
          upgrading_ids INTEGER[] DEFAULT '{}',
          governance_type_ids INTEGER[] DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('River projects table created');
    
    // Schritt 4: Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_river_projects_location ON river_projects USING GIST (location);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_issues_gin ON river_projects USING GIN (issue_ids);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_projects_ideas_gin ON river_projects USING GIN (idea_ids);');
    console.log('Indexes created');
    
    await client.end();
    console.log('Database connection closed');
    
    res.json({ message: 'Database tables created successfully!' });
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});