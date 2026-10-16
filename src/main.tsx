import React from 'react';
import ReactDOM from 'react-dom/client';
import { Calculator } from './features/calculator/Calculator';
import './styles.css';
import './calculator.css';
import './features.css';
import './graphs.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Calculator />
  </React.StrictMode>,
);
