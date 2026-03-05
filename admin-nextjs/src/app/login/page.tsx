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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
            G
          </div>
          <Typography.Title level={2} style={{ color: 'white', marginTop: 16, marginBottom: 4 }}>
            GBA Admin
          </Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            Connecte-toi pour accéder au tableau de bord
          </Typography.Text>
        </div>

        <Card styles={{ body: { padding: 20 } }} className="shadow-2xl">
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Email" name="email" rules={[{ required: true, message: 'Email requis' }]}>
              <Input prefix={<MailOutlined />} placeholder="admin@email.com" autoComplete="email" />
            </Form.Item>
            <Form.Item label="Mot de passe" name="password" rules={[{ required: true, message: 'Mot de passe requis' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="••••••••" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading || submitting}>
              Se connecter
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
