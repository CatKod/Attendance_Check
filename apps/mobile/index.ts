import { registerRootComponent } from 'expo';

import App from './src/App';

// registerRootComponent gọi AppRegistry.registerComponent('main', () => App)
// Đồng thời thiết lập môi trường cho cả Expo Go và native build.
registerRootComponent(App);
