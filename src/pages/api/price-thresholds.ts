// src/pages/api/price-thresholds.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { keccak256, toBytes } from 'viem';

interface PriceThreshold {
  phoneNumber: string;
  phoneHash: string;
  minLossPercentage: number;
  maxProfitPercentage: number;
  timestamp: number;
  walletAddress: string;
}

// Local storage path
const dataDir = join(process.cwd(), 'data');
const thresholdFile = join(dataDir, 'price-thresholds.json');

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function hashPhone(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  return keccak256(toBytes(normalized));
}

function loadThresholds(): PriceThreshold[] {
  if (existsSync(thresholdFile)) {
    try {
      return JSON.parse(readFileSync(thresholdFile, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveThresholds(thresholds: PriceThreshold[]) {
  // Ensure data directory exists
  const { mkdirSync } = require('fs');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  writeFileSync(thresholdFile, JSON.stringify(thresholds, null, 2));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Get all thresholds or specific phone
    const { phone } = req.query;
    const thresholds = loadThresholds();
    
    if (phone && typeof phone === 'string') {
      const phoneHash = hashPhone(phone);
      const threshold = thresholds.find(t => t.phoneHash === phoneHash);
      
      if (threshold) {
        res.json({ success: true, threshold });
      } else {
        res.status(404).json({ success: false, error: 'Threshold not found' });
      }
    } else {
      res.json({ success: true, thresholds });
    }
  }
  
  else if (req.method === 'POST') {
    // Set a new threshold
    const { phoneNumber, minLossPercentage, maxProfitPercentage, walletAddress } = req.body;
    
    if (!phoneNumber || minLossPercentage === undefined || maxProfitPercentage === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: phoneNumber, minLossPercentage, maxProfitPercentage' 
      });
    }
    
    if (typeof minLossPercentage !== 'number' || typeof maxProfitPercentage !== 'number') {
      return res.status(400).json({ 
        success: false, 
        error: 'Loss and profit percentages must be numbers' 
      });
    }
    
    if (minLossPercentage < 0 || maxProfitPercentage < 0 || minLossPercentage > 100 || maxProfitPercentage > 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Percentages must be between 0 and 100' 
      });
    }
    
    try {
      const phoneHash = hashPhone(phoneNumber);
      const thresholds = loadThresholds();
      
      // Remove existing threshold for this phone
      const filteredThresholds = thresholds.filter(t => t.phoneHash !== phoneHash);
      
      // Add new threshold
      const newThreshold: PriceThreshold = {
        phoneNumber: normalizePhoneNumber(phoneNumber),
        phoneHash,
        minLossPercentage: Number(minLossPercentage),
        maxProfitPercentage: Number(maxProfitPercentage),
        timestamp: Date.now(),
        walletAddress: walletAddress || 'unknown'
      };
      
      filteredThresholds.push(newThreshold);
      saveThresholds(filteredThresholds);
      
      res.json({ success: true, threshold: newThreshold });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to save threshold' 
      });
    }
  }
  
  else if (req.method === 'DELETE') {
    // Remove a threshold
    const { phone } = req.query;
    
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number parameter required' 
      });
    }
    
    try {
      const phoneHash = hashPhone(phone);
      const thresholds = loadThresholds();
      const initialLength = thresholds.length;
      
      const filteredThresholds = thresholds.filter(t => t.phoneHash !== phoneHash);
      
      if (filteredThresholds.length < initialLength) {
        saveThresholds(filteredThresholds);
        res.json({ success: true, message: 'Threshold removed' });
      } else {
        res.status(404).json({ success: false, error: 'Threshold not found' });
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to remove threshold' 
      });
    }
  }
  
  else {
    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}