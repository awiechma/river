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