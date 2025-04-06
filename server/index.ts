import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);
const app = express();

// Configure CORS to be more permissive in development
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://localhost:5173',
      'https://localhost:3000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Verificar si Ollama está corriendo
async function isOllamaRunning() {
  try {
    const { stdout } = await execAsync('pgrep ollama');
    return !!stdout;
  } catch {
    return false;
  }
}

// Verificar si el modelo está descargado
async function isModelDownloaded(model = 'mistral') {
  try {
    const { stdout } = await execAsync('ollama list');
    return stdout.includes(model);
  } catch {
    return false;
  }
}

app.post('/start-ollama', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ 
        success: false,
        error: 'Se requiere contraseña' 
      });
    }

    // Primero verificamos si Ollama ya está corriendo
    if (await isOllamaRunning()) {
      return res.json({ 
        success: true, 
        message: 'Ollama ya está corriendo' 
      });
    }

    // Intentar iniciar Ollama con sudo
    const sudoProcess = spawn('sudo', ['-S', 'ollama', 'serve'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Escribir la contraseña en stdin
    sudoProcess.stdin.write(password + '\n');
    sudoProcess.stdin.end();

    // Manejar la salida de error
    let errorOutput = '';
    sudoProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log('Ollama stderr:', data.toString());
    });

    // Manejar la salida estándar
    sudoProcess.stdout.on('data', (data) => {
      console.log('Ollama stdout:', data.toString());
    });

    // Esperar un poco para ver si hay errores inmediatos
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (errorOutput.toLowerCase().includes('incorrect password')) {
      return res.status(401).json({ 
        success: false,
        error: 'Contraseña incorrecta',
        details: 'La contraseña de administrador proporcionada no es correcta'
      });
    }

    // Verificar si Ollama se inició correctamente
    const isRunning = await isOllamaRunning();
    if (isRunning) {
      // Verificar si el modelo está descargado
      const modelExists = await isModelDownloaded();
      if (!modelExists) {
        // Iniciar descarga del modelo en segundo plano
        exec('ollama pull mistral', (error, stdout, stderr) => {
          if (error) {
            console.error('Error al descargar modelo:', error);
          } else {
            console.log('Modelo descargado correctamente');
          }
        });
      }

      return res.json({ 
        success: true,
        message: 'Ollama iniciado correctamente' 
      });
    }

    return res.status(500).json({ 
      success: false,
      error: 'No se pudo iniciar Ollama',
      details: errorOutput || 'No se recibió respuesta del servidor'
    });

  } catch (error) {
    console.error('Error al iniciar Ollama:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Error al iniciar Ollama',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

app.post('/chat', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { prompt, model = 'mistral', options = {}, password } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un prompt'
      });
    }

    if (!password) {
      return res.status(401).json({
        success: false,
        error: 'Se requiere contraseña de administrador'
      });
    }

    // Verificar que Ollama esté corriendo
    if (!await isOllamaRunning()) {
      return res.status(503).json({
        success: false,
        error: 'Ollama no está corriendo'
      });
    }

    // Hacer la petición a Ollama
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Error en la respuesta de Ollama: ${response.statusText}`);
    }

    const data = await response.json();
    return res.json({
      success: true,
      response: data.response
    });

  } catch (error) {
    console.error('Error en chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al procesar la consulta',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const isRunning = await isOllamaRunning();
    const modelExists = await isModelDownloaded();

    res.json({
      success: true,
      status: {
        running: isRunning,
        model_ready: modelExists
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al verificar estado',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Catch-all route to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});