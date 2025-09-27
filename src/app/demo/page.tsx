'use client';

import { useState } from 'react';
import { 
  Button, 
  Input, 
  Textarea, 
  Select, 
  Card, 
  CardHeader, 
  CardBody, 
  CardFooter,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ToastProvider,
  useToast,
  useToastHelpers
} from '@/components/ui';

function DemoContent() {
  const [inputValue, setInputValue] = useState('');
  const [textareaValue, setTextareaValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [multiSelectValue, setMultiSelectValue] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { addToast } = useToast();
  const { showSuccess, showError, showWarning, showInfo } = useToastHelpers();

  const selectOptions = [
    { value: 'option1', label: 'Opción 1' },
    { value: 'option2', label: 'Opción 2' },
    { value: 'option3', label: 'Opción 3' },
    { value: 'option4', label: 'Opción 4' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Demostración de Componentes UI
          </h1>
          <p className="text-lg text-gray-600">
            Todos los componentes reutilizables creados para tu aplicación
          </p>
        </div>

        {/* Buttons Section */}
        <Card>
          <CardHeader title="Botones" subtitle="Diferentes variantes y estados" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="primary">Primario</Button>
              <Button variant="secondary">Secundario</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructivo</Button>
              <Button variant="primary" size="sm">Pequeño</Button>
              <Button variant="primary" size="lg">Grande</Button>
              <Button variant="primary" loading>Cargando...</Button>
            </div>
          </CardBody>
        </Card>

        {/* Forms Section */}
        <Card>
          <CardHeader title="Formularios" subtitle="Inputs, Textarea y Select" />
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Input
                  label="Input básico"
                  placeholder="Escribe algo aquí..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                
                <Input
                  label="Input con error"
                  placeholder="Campo requerido"
                  error="Este campo es obligatorio"
                  helperText="Mensaje de ayuda"
                />
                
                <Textarea
                  label="Textarea"
                  placeholder="Escribe un texto largo..."
                  value={textareaValue}
                  onChange={(e) => setTextareaValue(e.target.value)}
                  autoResize
                  minRows={3}
                  maxRows={6}
                />
              </div>
              
              <div className="space-y-4">
                <Select
                  label="Select simple"
                  placeholder="Selecciona una opción"
                  options={selectOptions}
                  value={selectValue}
                  onChange={setSelectValue}
                />
                
                <Select
                  label="Select múltiple"
                  placeholder="Selecciona varias opciones"
                  options={selectOptions}
                  value={multiSelectValue}
                  onChange={setMultiSelectValue}
                  multiple
                />
                
                <Select
                  label="Select con búsqueda"
                  placeholder="Busca y selecciona"
                  options={selectOptions}
                  value={selectValue}
                  onChange={setSelectValue}
                  searchable
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="default">
            <CardHeader title="Card por defecto" subtitle="Descripción básica" />
            <CardBody>
              <p className="text-gray-600">
                Este es el contenido de una card básica con estilo por defecto.
              </p>
            </CardBody>
            <CardFooter>
              <Button variant="primary" size="sm">Acción</Button>
            </CardFooter>
          </Card>

          <Card variant="outlined">
            <CardHeader title="Card con borde" subtitle="Variante outlined" />
            <CardBody>
              <p className="text-gray-600">
                Esta card tiene un borde definido y fondo transparente.
              </p>
            </CardBody>
            <CardFooter>
              <Button variant="outline" size="sm">Ver más</Button>
            </CardFooter>
          </Card>

          <Card variant="elevated">
            <CardHeader title="Card elevada" subtitle="Con sombra pronunciada" />
            <CardBody>
              <p className="text-gray-600">
                Esta card tiene una sombra más pronunciada para destacar.
              </p>
            </CardBody>
            <CardFooter>
              <Button variant="secondary" size="sm">Explorar</Button>
            </CardFooter>
          </Card>
        </div>

        {/* Toast Section */}
        <Card>
          <CardHeader title="Notificaciones Toast" subtitle="Diferentes tipos de mensajes" />
          <CardBody>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                onClick={() => showSuccess('¡Operación exitosa!')}
              >
                Toast Éxito
              </Button>
              <Button 
                variant="outline" 
                onClick={() => showError('Error en la operación')}
              >
                Toast Error
              </Button>
              <Button 
                variant="outline" 
                onClick={() => showWarning('Advertencia importante')}
              >
                Toast Advertencia
              </Button>
              <Button 
                variant="outline" 
                onClick={() => showInfo('Información útil')}
              >
                Toast Info
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Modal Section */}
        <Card>
          <CardHeader title="Modal" subtitle="Ventanas emergentes" />
          <CardBody>
            <div className="space-x-4">
              <Button onClick={() => setIsModalOpen(true)}>
                Abrir Modal
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Modal Component */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          size="md"
        >
          <ModalHeader title="Modal de Ejemplo" onClose={() => setIsModalOpen(false)} />
          <ModalBody>
            <p className="text-gray-600 mb-4">
              Este es un modal de ejemplo que muestra cómo usar el componente Modal.
            </p>
            <Input 
              label="Campo de ejemplo"
              placeholder="Puedes incluir formularios aquí"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => setIsModalOpen(false)}>
              Confirmar
            </Button>
          </ModalFooter>
        </Modal>

      </div>
    </div>
  );
}

export default function DemoPage() {
  return (
    <ToastProvider>
      <DemoContent />
    </ToastProvider>
  );
}