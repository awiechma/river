import React from 'react';
import { useState, useEffect } from 'react';
import './css/Footer.css';

const Footer = () => {
    const REACT_APP_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const [stats, setStats] = useState({
    totalProjects: 0,
    totalCountries: 0,
    loading: true
  });

  useEffect(() => {
    // Fetch footer statistics
    const fetchFooterStats = async () => {
      try {
        const response = await fetch(`${REACT_APP_API_URL}/api/footer-stats`);

        if (response.ok) {
          const data = await response.json();
          
          console.log('Footer stats fetched:', data);
          
          setStats({
            totalProjects: data.totalProjects || 0,
            totalCountries: data.totalCountries || 0,
            loading: false
          });
        } else {
          console.error('API response not ok:', response.status);
          setStats(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error('Error fetching footer stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchFooterStats();
  }, []);

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* Main Info Section */}
          <div className="footer-section">
            <h3 className="footer-title">River Restoration Database</h3>
            <p className="footer-description">
              A comprehensive database of innovative river restoration projects 
              showcasing sustainable solutions for ecological, economic, and social challenges.
            </p>
            <div className="footer-stats">
              <div className="stat">
                <span className="stat-number">
                  {stats.loading ? '...' : stats.totalProjects}
                </span>
                <span className="stat-label">Projects</span>
              </div>
              <div className="stat">
                <span className="stat-number">
                  {stats.loading ? '...' : stats.totalCountries}
                </span>
                <span className="stat-label">Countries</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-section">
            <h4 className="footer-subtitle">Quick Links</h4>
            <ul className="footer-links">
              <li><a href="#projects" className="footer-link">____________</a></li>
              <li><a href="#categories" className="footer-link">____________</a></li>
              <li><a href="#statistics" className="footer-link">____________</a></li>
              <li><a href="#about" className="footer-link">____________</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="footer-section">
            <h4 className="footer-subtitle">Resources</h4>
            <ul className="footer-links">
              <li><a href={`${REACT_APP_API_URL}/api/projects`} className="footer-link">API: All Projects</a></li>
              <li><a href={`${REACT_APP_API_URL}/api/footer-stats`} className="footer-link">API: Statistics</a></li>
              <li><a href={`${REACT_APP_API_URL}/api/filter-options`} className="footer-link">API: Filter Options</a></li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div className="footer-section">
            <h4 className="footer-subtitle">Connect</h4>
            <div className="contact-info">
              <p className="contact-item">
                <span className="contact-icon">📧</span>
                contact@abc.org
              </p>
              <p className="contact-item">
                <span className="contact-icon">🌐</span>
                www.abc.org
              </p>
              <p className="contact-item">
                <span className="contact-icon">📊</span>
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <div className="copyright">
              <p>&copy; 2024 River Restoration Database. Open Data Initiative.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;