import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';

/**
 * MQTT messaging service for IoT mode
 */
@Injectable()
export class MessagingService implements OnModuleInit {
  private readonly logger = new Logger(MessagingService.name);
  private client: mqtt.MqttClient | null = null;
  private isConnected = false;

  async onModuleInit() {
    if (process.env.MODE === 'IOT' && process.env.MQTT_BROKER_URL) {
      await this.connect();
    }
  }

  /**
   * Connect to MQTT broker
   */
  async connect() {
    try {
      const brokerUrl = process.env.MQTT_BROKER_URL;
      if (!brokerUrl) {
        this.logger.warn('MQTT broker URL not configured');
        return;
      }

      this.client = mqtt.connect(brokerUrl, {
        clientId: process.env.MQTT_CLIENT_ID || 'vcel-client',
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        clean: true,
        reconnectPeriod: 5000,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Connected to MQTT broker');
      });

      this.client.on('error', (error) => {
        this.logger.error(`MQTT error: ${error.message}`, error.stack);
      });

      this.client.on('disconnect', () => {
        this.isConnected = false;
        this.logger.warn('Disconnected from MQTT broker');
      });
    } catch (error) {
      this.logger.error(`Failed to connect to MQTT broker: ${error.message}`, error.stack);
    }
  }

  /**
   * Publish message to a topic
   */
  async publish(topic: string, message: any): Promise<void> {
    if (!this.client || !this.isConnected) {
      this.logger.warn('MQTT client not connected, skipping publish');
      return;
    }

    try {
      const payload = typeof message === 'string' ? message : JSON.stringify(message);

      await new Promise<void>((resolve, reject) => {
        this.client.publish(topic, payload, { qos: 1 }, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.logger.debug(`Published message to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to publish to topic ${topic}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(topic: string, callback: (message: any) => void): Promise<void> {
    if (!this.client || !this.isConnected) {
      this.logger.warn('MQTT client not connected, skipping subscribe');
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.client.subscribe(topic, { qos: 1 }, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.client.on('message', (receivedTopic, payload) => {
        if (receivedTopic === topic) {
          try {
            const message = JSON.parse(payload.toString());
            callback(message);
          } catch (error) {
            // If not JSON, pass as string
            callback(payload.toString());
          }
        }
      });

      this.logger.log(`Subscribed to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client.end(false, {}, () => {
          this.isConnected = false;
          this.logger.log('Disconnected from MQTT broker');
          resolve();
        });
      });
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      brokerUrl: process.env.MQTT_BROKER_URL,
    };
  }
}
