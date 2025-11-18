// Utility for consistent logging throughout the app

const isDevelopment = import.meta.env.DEV;

export const logger = {
  info: (...args) => {
    if (isDevelopment) {
      console.log('ℹ️', ...args);
    }
  },
  
  success: (...args) => {
    if (isDevelopment) {
      console.log('✅', ...args);
    }
  },
  
  error: (...args) => {
    console.error('❌', ...args);
  },
  
  warn: (...args) => {
    console.warn('⚠️', ...args);
  },
  
  api: (type, ...args) => {
    if (isDevelopment) {
      const emoji = type === 'request' ? '🚀' : type === 'response' ? '✅' : '❌';
      console.log(emoji, ...args);
    }
  },
  
  component: (componentName, action, ...args) => {
    if (isDevelopment) {
      console.log(`🔷 [${componentName}]`, action, ...args);
    }
  },
};

export default logger;

