import React from 'react';
import ReactDOM from 'react-dom/client';
import './components/css/index.css';
import App from './components/App';
import Footer from './components/Footer'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
    <Footer/>
  </React.StrictMode>
);