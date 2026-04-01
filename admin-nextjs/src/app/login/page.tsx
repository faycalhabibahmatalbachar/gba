'use client';

import React, { useState } from 'react';
import { Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { signIn, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, #080C14 60%)',
        backgroundColor: '#080C14',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo + title */}
        <div className="text-center" style={{ marginBottom: 32 }}>
          <div
            className="mx-auto flex items-center justify-center text-white font-bold shadow-lg"
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              fontSize: 28,
              fontFamily: 'var(--font-heading)',
            }}
          >
            G
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: 24,
              color: '#F1F5F9',
              marginTop: 20,
              marginBottom: 6,
            }}
          >
            GBA Admin
          </h1>
          <p style={{ color: '#94A3B8', fontSize: 13 }}>
            Connecte-toi pour accéder au tableau de bord
          </p>
        </div>

        {/* Login card */}
        <div
          style={{
            background: '#0E1623',
            border: '1px solid #1E2D45',
            borderRadius: 16,
            padding: 40,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Email" name="email" rules={[{ required: true, message: 'Email requis' }]}>
              <Input prefix={<MailOutlined style={{ color: '#475569' }} />} placeholder="admin@email.com" autoComplete="email" />
            </Form.Item>
            <Form.Item label="Mot de passe" name="password" rules={[{ required: true, message: 'Mot de passe requis' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#475569' }} />} placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading || submitting}
              style={{ height: 42, fontWeight: 600, fontSize: 14, marginTop: 8 }}
            >
              Se connecter
            </Button>
          </Form>
        </div>
      </div>
    </div>
  );
}
