export type LegalModalKey = 'privacy' | 'cookies' | 'terms' | 'delivery' | 'security' | 'contact';

export interface LegalModalContent {
  title: string;
  body: string[];
}

export const legalContent: Record<LegalModalKey, LegalModalContent> = {
  privacy: {
    title: 'Aviso de Privacidad',
    body: [
      'Tiquea respeta la privacidad de sus usuarios. Este Aviso de Privacidad describe qué datos personales recopilamos, para qué los utilizamos y cómo los protegemos.',
      'Podemos recopilar nombre, correo, teléfono, información de uso, historial dentro de la aplicación, datos técnicos como IP, navegador, sistema operativo, ubicación aproximada si la app lo requiere y datos de pago o facturación cuando se utilizan servicios de cobro.',
      'Los datos se utilizan para operar la aplicación, mantener la cuenta, atender soporte, procesar pagos, mejorar la experiencia, cumplir obligaciones legales, prevenir fraudes y ofrecer comunicaciones vinculadas al servicio.',
      'Nunca venderemos tus datos personales. Solo los compartiremos con proveedores de servicios necesarios para funcionamiento, analítica, pagos, almacenamiento, atención al cliente y cumplimiento legal, siempre bajo medidas razonables de protección.',
      'El usuario podrá ejercer sus derechos de acceso, rectificación, cancelación y oposición (ARCO) enviando solicitud a hola@tiquea.app o a través del contacto disponible en la web.',
      'Las imágenes de recibos o tickets que se carguen al sistema se procesan únicamente para la extracción de información y no se conservan como archivo permanente si no es necesario para ofrecer el servicio. Las credenciales y datos sensibles se protegen con cifrado y controles de seguridad.',
      'Podemos actualizar este aviso en cualquier momento. Los cambios relevantes se publicarán en esta misma sección y se indicará la fecha de actualización.',
    ],
  },
  cookies: {
    title: 'Política de Cookies',
    body: [
      'Nuestra web utiliza cookies y tecnologías similares para mejorar la navegación, recordar preferencias, ofrecer una experiencia más útil y analizar el uso del sitio. Las cookies necesarias permiten el correcto funcionamiento de la app.',
      'También podemos usar cookies analíticas y de terceros para medir tráfico, rendimiento, campañas publicitarias y comportamiento general. Antes de activar cookies no esenciales, se solicitará el consentimiento explícito del usuario.',
      'El usuario puede aceptar, rechazar o configurar sus preferencias desde el banner de cookies o desde la configuración del navegador. La desactivación de cookies puede afectar funciones como analítica, personalización y seguridad.',
      'Los terceros que puedan utilizar cookies incluyen proveedores de análisis, publicidad, pagos y servicios de infraestructura. Sus políticas de privacidad pueden aplicarse de forma independiente a la de Tiquea.',
    ],
  },
  terms: {
    title: 'Términos y Condiciones',
    body: [
      'Al usar Tiquea, el usuario acepta que la plataforma es una herramienta para calcular, dividir y gestionar cuentas entre personas, con apoyo de funciones de IA para reconocer información de recibos o tickets. El servicio se brinda con fines informativos y de apoyo operativo.',
      'El usuario es responsable de la información que ingrese, de verificar los resultados antes de compartirlos, aceptarlos o utilizarlos para realizar pagos. Los cálculos, sugerencias o resultados generados por IA pueden contener errores o variaciones y deben revisarse antes de tomar decisiones importantes.',
      'No está permitido utilizar la plataforma para actividades ilegales, fraudulentas, maliciosas, ofensivas, relacionadas con contenido no autorizado o que viole derechos de terceros. Tiquea puede restringir, suspender o eliminar cuentas o contenido que incumplan estas reglas.',
      'Tiquea, su diseño, logotipos, textos, código y contenido asociado son propiedad de la marca o de sus licenciatarios. Queda prohibida la reproducción, distribución o uso no autorizado de estos elementos.',
      'Tiquea no garantiza disponibilidad ininterrumpida del servicio ni ausencia total de errores. En la medida permitida por la ley, la plataforma no será responsable por daños indirectos, incidentales, consecuentes o pérdida de datos derivados del uso del servicio, salvo que exista obligación legal expresa.',
    ],
  },
  delivery: {
    title: 'Política de Delivery',
    body: [
      'Si Tiquea ofrece servicios de entrega, delivery o envío asociado a algún producto o servicio, esta política aplica a los pedidos o solicitudes realizadas a través de la plataforma.',
      'Los tiempos de entrega son estimados y pueden variar por tráfico, logística, disponibilidad del proveedor, condiciones climáticas, cierres temporales o eventos ajenos al control de Tiquea. La confirmación del pedido no garantiza una entrega exacta a la hora indicada.',
      'Los costos, zonas de cobertura, tiempos y métodos de pago se informarán claramente antes de confirmar la operación. En caso de cancelación, devolución o cambio, se aplicará la política vigente y los términos del proveedor o del servicio correspondiente.',
      'El usuario deberá proporcionar datos completos y correctos para la entrega, incluyendo dirección, referencias y contacto. Tiquea no será responsable por retrasos o errores cuando la información proporcionada por el cliente sea incompleta o incorrecta.',
      'En caso de incidentes con entregas, daños, retrasos o productos no conformes, el cliente puede comunicarlo a hola@tiquea.app para revisión y atención.',
    ],
  },
  security: {
    title: 'Política de Seguridad',
    body: [
      'La seguridad de la información es prioridad para Tiquea. Implementamos medidas razonables de seguridad técnica, administrativa y física para proteger el acceso a los datos y prevenir uso indebido, robo, pérdida o alteración.',
      'Entre estas medidas se encuentran cifrado de credenciales y tráfico en tránsito, controles de acceso, respaldo de datos, registro de auditoría, mitigación de vulnerabilidades y buenas prácticas de desarrollo seguro.',
      'Sin embargo, ninguna plataforma o sistema online garantiza seguridad absoluta. El usuario también debe proteger sus contraseñas, no compartir credenciales y mantener actualizado su dispositivo y navegador.',
      'En caso de detectar un incidente de seguridad, Tiquea realizará la revisión y notificación según la legislación aplicable y las mejores prácticas de protección de datos.',
    ],
  },
  contact: {
    title: 'Contacto y Derechos ARCO',
    body: [
      'Para ejercer sus derechos de acceso, rectificación, cancelación, oposición, transparencia, portabilidad o cualquier consulta relacionada con privacidad, seguridad, cookies o uso del servicio, puede contactarnos en:',
      'Correo: hola@tiquea.app',
      'Teléfono: +52 55 0000 0000',
      'Sitio: https://tiquea.app',
      'Las solicitudes serán atendidas en los plazos legales que correspondan y, en su caso, se requerirá información adicional para verificar la identidad del solicitante.',
    ],
  },
};
