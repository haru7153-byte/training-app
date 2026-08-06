import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native'
import { supabase } from '../lib/supabase'
import { C, styles } from '../lib/theme'

export default function AuthScreen() {
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function sendCode() {
    if (!email.trim()) return
    setSending(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    if (error) {
      setError('送信に失敗しました。メールアドレスを確認してください。')
    } else {
      setStage('code')
      setMessage(`${email.trim()} に確認コードを送信しました`)
    }
    setSending(false)
  }

  async function verifyCode() {
    if (!code.trim()) return
    setVerifying(true)
    setError('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    if (error) {
      setError('コードが正しくないか、期限切れです。')
    }
    setVerifying(false)
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 300, gap: 10 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: C.text, textAlign: 'center', marginBottom: 2 }}>AI CycleNote</Text>
            <Text style={{ fontSize: 12, color: C.sub, textAlign: 'center', marginBottom: 8 }}>
              {stage === 'email' ? 'メールアドレスでログイン' : '届いた6桁コードを入力してください'}
            </Text>

            {stage === 'email' ? (
              <>
                <TextInput
                  style={[styles.input, { flex: 0, fontSize: 14, paddingVertical: 9 }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={C.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
                <TouchableOpacity
                  style={[styles.btn, { alignItems: 'center', paddingVertical: 9, opacity: sending ? 0.5 : 1 }]}
                  onPress={sendCode}
                  disabled={sending}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{sending ? '送信中...' : 'コードを送信'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {message !== '' && <Text style={{ fontSize: 11, color: C.green, textAlign: 'center' }}>{message}</Text>}
                <TextInput
                  style={{
                    alignSelf: 'center', width: 168, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
                    borderRadius: 10, paddingVertical: 9, color: C.text, fontSize: 20, fontWeight: '700',
                    letterSpacing: 6, textAlign: 'center',
                  }}
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                  textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[styles.btn, { alignItems: 'center', paddingVertical: 9, opacity: verifying ? 0.5 : 1 }]}
                  onPress={verifyCode}
                  disabled={verifying}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{verifying ? '確認中...' : '確認してログイン'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setStage('email'); setCode(''); setMessage(''); setError('') }}>
                  <Text style={{ fontSize: 11, color: C.muted, textAlign: 'center' }}>メールアドレスを変更する / 再送信</Text>
                </TouchableOpacity>
              </>
            )}

            {error !== '' && <Text style={{ fontSize: 11, color: C.red, textAlign: 'center' }}>{error}</Text>}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

